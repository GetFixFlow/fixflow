require "rails_helper"

RSpec.describe "Signing in through OpenID Connect", type: :request do
  let!(:org) { create(:organization) }
  let(:web) { EmailSetup.base_url }
  let(:cache) { ActiveSupport::Cache::MemoryStore.new }

  # The single-use note needs a cache that remembers (the test one does not); the throttles share the cache, so they step aside.
  around do |example|
    Rack::Attack.enabled = false
    example.run
  ensure
    Rack::Attack.enabled = true
  end

  before do
    allow(Rails).to receive(:cache).and_return(cache)
    save_directory_settings(org)
  end

  # Starts the sign-in the way the browser does, and returns what the provider was sent: state, nonce, challenge.
  def start
    stub_provider
    get "/api/v1/auth/oidc/start"
    Rack::Utils.parse_query(URI.parse(response.headers["Location"]).query)
  end

  def finish(sent, token: nil, **claims)
    stub_provider(id_token: token || fake_provider.id_token(nonce: sent["nonce"], **claims))
    get "/api/v1/auth/oidc/callback", params: { code: "code-1", state: sent["state"] }
  end

  def location = URI.parse(response.headers["Location"])
  def error_code = Rack::Utils.parse_query(location.query)["directory_error"]

  describe "GET /api/v1/auth/directory" do
    it "tells the sign-in screen what is offered, to anyone" do
      get "/api/v1/auth/directory"

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("oidc" => { "enabled" => true, "label" => "Company account" }, "ldap" => { "enabled" => false })
    end

    it "offers nothing to a company that has not set it up" do
      org.update!(directory_settings: {})

      get "/api/v1/auth/directory"

      expect(json_body["oidc"]["enabled"]).to be(false)
    end

    it "never shows a secret" do
      get "/api/v1/auth/directory"

      expect(response.body).not_to include("s3cret")
      expect(response.body).not_to include(DirectoryHelpers::ISSUER)
    end
  end

  describe "GET /api/v1/auth/oidc/start" do
    it "sends the browser to the provider with PKCE, and keeps the browser's side in a cookie only it can read" do
      sent = start

      expect(response).to have_http_status(:found)
      expect(response.headers["Location"]).to start_with("#{DirectoryHelpers::ISSUER}/protocol/openid-connect/auth?")
      expect(sent).to include("code_challenge_method" => "S256", "response_type" => "code")
      expect(sent["state"]).to be_present
      expect(sent["nonce"]).to be_present
      cookies = Array(response.headers["Set-Cookie"]).join("\n").split(/\n|,\s*(?=[A-Za-z_]+=)/) # one entry for each cookie set
      cookie = cookies.find { |entry| entry.start_with?("fixflow_oidc=") }
      expect(cookie).to match(/httponly/i).and match(/samesite=lax/i).and include("path=/api/v1/auth/oidc")
      expect(cookie).not_to include(sent["state"]) # encrypted, not just signed: the PKCE verifier is inside
    end

    it "sends a challenge that is the hash of the verifier it later gives the provider" do
      sent = start
      finish(sent)

      verifier = nil
      expect(a_request(:post, fake_provider.discovery["token_endpoint"]).with { |req|
        verifier = Rack::Utils.parse_query(req.body)["code_verifier"]
      }).to have_been_made
      expect(Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)).to eq(sent["code_challenge"])
    end

    it "gives each sign-in its own state, nonce and challenge" do
      first = start
      second = start

      expect(first.values_at("state", "nonce", "code_challenge")).not_to eq(second.values_at("state", "nonce", "code_challenge"))
    end

    it "sends the browser back to the sign-in screen when the company has not set it up" do
      org.update!(directory_settings: {})

      get "/api/v1/auth/oidc/start"

      expect(response.headers["Location"]).to eq("#{web}/login?directory_error=not_set_up")
    end

    it "sends the browser back to the sign-in screen when the provider cannot be reached" do
      stub_request(:get, "#{DirectoryHelpers::ISSUER}/.well-known/openid-configuration").to_timeout

      get "/api/v1/auth/oidc/start"

      expect(response.headers["Location"]).to eq("#{web}/login?directory_error=unreachable")
    end
  end

  describe "GET /api/v1/auth/oidc/callback" do
    it "makes the account, and hands the browser a note to swap for a session" do
      sent = start
      finish(sent)

      expect(response).to have_http_status(:found)
      expect(location.to_s).to start_with("#{web}/login/directory?code=")
      expect(User.find_by(email: "sam@example.test")).to have_attributes(role: "technician", identity_provider: "oidc")
      expect(UserSession.count).to eq(0) # no session yet: only the note
    end

    it "never puts a session token in the address" do
      sent = start
      finish(sent)

      expect(location.to_s).not_to include("Bearer")
      expect(response.headers["Authorization"]).to be_nil
    end

    it "is refused when the state is not the one this browser started with" do
      sent = start
      stub_provider(id_token: fake_provider.id_token(nonce: sent["nonce"]))

      get "/api/v1/auth/oidc/callback", params: { code: "code-1", state: "somebody-elses" }

      expect(error_code).to eq("failed")
      expect(User.where(email: "sam@example.test")).to be_empty
    end

    it "is refused when this browser never started a sign-in (a link someone else made)" do
      stub_provider(id_token: fake_provider.id_token(nonce: "x"))

      get "/api/v1/auth/oidc/callback", params: { code: "code-1", state: "anything" }

      expect(error_code).to eq("failed")
    end

    it "cannot be finished twice: the browser's side is gone after the first return" do
      sent = start
      finish(sent)
      expect(location.to_s).to include("/login/directory")

      get "/api/v1/auth/oidc/callback", params: { code: "code-1", state: sent["state"] }

      expect(error_code).to eq("failed")
    end

    it "is refused when the id token answers another sign-in (nonce)" do
      sent = start
      finish(sent, token: fake_provider.id_token(nonce: "not-this-one"))

      expect(error_code).to eq("failed")
      expect(User.where(email: "sam@example.test")).to be_empty
    end

    it "tells the sign-in screen when the provider says the person said no" do
      start

      get "/api/v1/auth/oidc/callback", params: { error: "access_denied", state: "x" }

      expect(error_code).to eq("denied")
    end

    it "turns away a person in none of the groups, and says why in the audit log" do
      sent = start
      finish(sent, groups: ["marketing"])

      expect(error_code).to eq("not_allowed")
      expect(User.where(email: "sam@example.test")).to be_empty
      expect(ActivityLog.where(action: "directory.sign_in_refused").last.metadata).to include("reason" => "not_allowed",
"email" => "sam@example.test")
    end

    it "turns away a deactivated person" do
      sent = start
      finish(sent)
      User.find_by(email: "sam@example.test").update!(deactivated_at: Time.current)

      sent = start
      finish(sent)

      expect(error_code).to eq("deactivated")
    end

    it "sends the browser back with a code, never details, when the provider misbehaves" do
      sent = start
      stub_provider(token_status: 500)

      get "/api/v1/auth/oidc/callback", params: { code: "c", state: sent["state"] }

      expect(error_code).to eq("failed")
      expect(response.headers["Location"]).not_to include("invalid_grant")
    end
  end

  describe "POST /api/v1/auth/directory" do
    def note_for(sent = start)
      finish(sent)
      Rack::Utils.parse_query(location.query)["code"]
    end

    it "swaps the note for a session, as signing in does" do
      post "/api/v1/auth/directory", params: { code: note_for }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.headers["Authorization"]).to match(/\ABearer /)
      expect(json_body["user"]).to include("email" => "sam@example.test", "role" => "technician", "identity_provider" => "oidc")
      expect(UserSession.count).to eq(1)
    end

    it "works once" do
      code = note_for
      post "/api/v1/auth/directory", params: { code: code }, as: :json
      expect(response).to have_http_status(:ok)

      post "/api/v1/auth/directory", params: { code: code }, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(json_body["code"]).to eq("DIRECTORY_CODE_INVALID")
    end

    it "refuses a note that was not made here" do
      post "/api/v1/auth/directory", params: { code: "forged" }, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(response.headers["Authorization"]).to be_nil
    end

    it "refuses the note of a person deactivated since" do
      code = note_for
      User.find_by(email: "sam@example.test").update!(deactivated_at: Time.current)

      post "/api/v1/auth/directory", params: { code: code }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "gives a session that works for the API, with the role the group gave" do
      post "/api/v1/auth/directory", params: { code: note_for }, as: :json

      get "/api/v1/auth/me", headers: { "Authorization" => response.headers["Authorization"] }

      expect(response).to have_http_status(:ok)
      expect(json_body["role"]).to eq("technician")
    end
  end
end
