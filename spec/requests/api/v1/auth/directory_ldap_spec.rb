require "rails_helper"

# Signing in with a username or email and password at the ordinary sign-in endpoint, for a company with LDAP set up.
RSpec.describe "Signing in through LDAP", type: :request do
  let!(:org) { create(:organization) }
  let(:ldap) { instance_double(Directory::Ldap) }
  let(:identity) do
    Directory::Identity.new(provider: "ldap", subject: "uuid-jo", email: "jo@acme.test", first_name: "Jo", last_name: "Reyes",
                            groups: ["cn=fixflow-managers,ou=groups,dc=acme,dc=test"], email_verified: true)
  end

  before do
    DirectorySettings.new(ldap_enabled: true, ldap_host: "ldap.acme.test", ldap_user_base: "ou=people,dc=acme,dc=test",
                          role_groups: { "manager" => ["fixflow-managers"], "admin" => ["fixflow-admins"] }).save_to(org)
    allow(Directory::Ldap).to receive(:new).and_return(ldap)
    allow(ldap).to receive(:authenticate).and_return(nil)
    allow(ldap).to receive(:authenticate).with("jo", "jo-pass").and_return(identity)
  end

  def sign_in_as(login, password) = post("/api/v1/auth/sign_in", params: { user: { email: login, password: password } }, as: :json)

  it "signs a person in with their directory username, making their account with the role their group gives" do
    sign_in_as("jo", "jo-pass")

    expect(response).to have_http_status(:ok)
    expect(response.headers["Authorization"]).to match(/\ABearer /)
    expect(json_body["user"]).to include("email" => "jo@acme.test", "role" => "manager", "identity_provider" => "ldap",
                                         "full_name" => "Jo Reyes")
    expect(UserSession.count).to eq(1)
  end

  it "gives a working session" do
    sign_in_as("jo", "jo-pass")

    get "/api/v1/auth/me", headers: { "Authorization" => response.headers["Authorization"] }

    expect(response).to have_http_status(:ok)
  end

  it "answers a wrong password like any other: 401, no session, and no hint whether the person exists" do
    sign_in_as("jo", "wrong")

    expect(response).to have_http_status(:unauthorized)
    expect(response.headers["Authorization"]).to be_nil
    expect(User.where(email: "jo@acme.test")).to be_empty
  end

  it "turns away a person in none of the groups, with the words for it, and logs it" do
    allow(ldap).to receive(:authenticate).with("jo", "jo-pass").and_return(
      Directory::Identity.new(provider: "ldap", subject: "uuid-jo", email: "jo@acme.test", groups: ["marketing"])
    )

    sign_in_as("jo", "jo-pass")

    expect(response).to have_http_status(:forbidden)
    expect(json_body).to include("code" => "DIRECTORY_NOT_ALLOWED")
    expect(json_body["error"]).to match(/not in a group/)
    expect(response.headers["Authorization"]).to be_nil
    expect(ActivityLog.where(action: "directory.sign_in_refused").count).to eq(1)
  end

  it "answers 503 with words, not a stack trace, when the directory is down" do
    allow(ldap).to receive(:authenticate).and_raise(Directory::Error, "Could not use the directory at ldap.acme.test: refused")

    sign_in_as("jo", "jo-pass")

    expect(response).to have_http_status(:service_unavailable)
    expect(json_body["code"]).to eq("DIRECTORY_UNREACHABLE")
    expect(response.body).not_to include("ldap.acme.test") # the reason is in the log, for the administrator, not on the screen
  end

  it "does not ask the directory when the person has a FixFlow account and the password is right for it" do
    local = create(:user, organization: org, email: "admin@acme.test", role: "admin")
    expect(ldap).not_to receive(:authenticate)

    sign_in_as(local.email, "password123")

    expect(response).to have_http_status(:ok)
  end

  it "tries the directory when the FixFlow password is wrong, and 401 if that fails too" do
    local = create(:user, organization: org, email: "admin@acme.test", role: "admin")
    allow(ldap).to receive(:authenticate).with("admin@acme.test", "not-the-password").and_return(nil)

    sign_in_as(local.email, "not-the-password")

    expect(ldap).to have_received(:authenticate).with("admin@acme.test", "not-the-password").once # rubocop:disable RSpec/MessageSpies
    expect(response).to have_http_status(:unauthorized)
  end

  it "signs a person who joined the directory in again, and keeps one account" do
    sign_in_as("jo", "jo-pass")
    sign_in_as("jo", "jo-pass")

    expect(response).to have_http_status(:ok)
    expect(User.where(email: "jo@acme.test").count).to eq(1)
    expect(UserSession.count).to eq(2)
  end

  it "does not ask for a second factor of a person the directory signed in" do
    sign_in_as("jo", "jo-pass")

    expect(json_body).not_to have_key("two_factor_required")
  end

  it "refuses a deactivated person, though the directory knows the password" do
    sign_in_as("jo", "jo-pass")
    User.find_by(email: "jo@acme.test").update!(deactivated_at: Time.current)

    sign_in_as("jo", "jo-pass")

    expect(response).to have_http_status(:forbidden)
    expect(json_body["code"]).to eq("DIRECTORY_DEACTIVATED")
  end

  it "leaves password sign-in exactly as it was for a company that has not set up LDAP" do
    org.update!(directory_settings: {})
    local = create(:user, organization: org)

    expect(ldap).not_to receive(:authenticate)

    sign_in_as(local.email, "password123")
    expect(response).to have_http_status(:ok)

    sign_in_as("jo", "jo-pass")
    expect(response).to have_http_status(:unauthorized)
  end

  it "takes no hash or array where it wants text" do
    expect(ldap).not_to receive(:authenticate)

    post "/api/v1/auth/sign_in", params: { user: { email: { a: 1 }, password: ["x"] } }, as: :json

    expect(response.status).to be_in([401, 400])
  end
end
