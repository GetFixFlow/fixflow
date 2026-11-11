require "rails_helper"

RSpec.describe "Company sign-in settings", type: :request do
  let(:org)   { create(:organization) }
  let(:admin) { create(:user, :admin, organization: org) }
  let(:headers) { auth_headers_for(admin) }

  let(:oidc_form) do
    { oidc_enabled: true, oidc_issuer: DirectoryHelpers::ISSUER, oidc_client_id: "fixflow", oidc_client_secret: "s3cret",
      role_groups: { admin: "fixflow-admins", technician: "fixflow-technicians\ncrew" } }
  end

  def save(settings, as: headers) = patch("/api/v1/directory_settings", params: { settings: settings }, as: :json, headers: as)
  def settings = json_body["settings"]

  describe "who may" do
    it "is for administrators only, in every way" do
      [create(:user, :manager, organization: org), create(:user, organization: org),
       create(:user, :requester, organization: org)].each do |person|
        get "/api/v1/directory_settings", headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
        save({ oidc_label: "x" }, as: auth_headers_for(person))
        expect(response).to have_http_status(:forbidden)
        delete "/api/v1/directory_settings", headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
        post "/api/v1/directory_settings/test", params: { kind: "oidc", settings: oidc_form }, as: :json,
headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
      end
    end

    it "needs a sign-in" do
      get "/api/v1/directory_settings"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET" do
    it "starts with everything off, and the address to register with the provider" do
      get "/api/v1/directory_settings", headers: headers

      expect(response).to have_http_status(:ok)
      expect(settings).to include("oidc_enabled" => false, "ldap_enabled" => false, "oidc_secret_set" => false, "sync_roles" => true,
                                  "oidc_scopes" => "openid email profile", "roles" => User::ROLES)
      expect(json_body["callback_url"]).to end_with("/api/v1/auth/oidc/callback")
    end
  end

  describe "PATCH" do
    it "saves the settings, with the groups of each role as a list" do
      save(oidc_form)

      expect(response).to have_http_status(:ok)
      expect(settings).to include("oidc_enabled" => true, "oidc_issuer" => DirectoryHelpers::ISSUER, "oidc_secret_set" => true)
      expect(settings["role_groups"]).to eq("admin" => ["fixflow-admins"], "technician" => %w[fixflow-technicians crew])
      expect(org.reload.directory_settings_config.oidc?).to be(true)
    end

    it "never sends a secret back, and stores it encrypted" do
      save(oidc_form.merge(ldap_bind_password: "bind-pass"))

      expect(response.body).not_to include("s3cret")
      expect(response.body).not_to include("bind-pass")
      expect(org.reload.directory_settings.to_json).not_to include("s3cret")
    end

    it "keeps the saved secret when a later save leaves it blank" do
      save(oidc_form)
      save({ oidc_label: "Acme", oidc_client_secret: "" })

      expect(org.reload.directory_settings_config.oidc_client_secret).to eq("s3cret")
      expect(settings["oidc_label"]).to eq("Acme")
    end

    it "keeps the groups when a later save does not mention them" do
      save(oidc_form)
      save({ oidc_label: "Acme" })

      expect(settings["role_groups"]).to include("admin" => ["fixflow-admins"])
    end

    it "refuses to switch it on with nobody able to get a role, and saves nothing" do
      save({ oidc_enabled: true, oidc_issuer: DirectoryHelpers::ISSUER, oidc_client_id: "fixflow" })

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to match(/groups for at least one role/)
      expect(org.reload.directory_settings).to eq({})
    end

    it "refuses an issuer that is not https" do
      save(oidc_form.merge(oidc_issuer: "http://idp.example.test/realms/acme"))

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "ignores a role it does not know, and fields it does not know" do
      save(oidc_form.merge(role_groups: { admin: "a", owner: "o" }, bogus: "x"))

      expect(response).to have_http_status(:ok)
      expect(settings["role_groups"]).to eq("admin" => ["a"])
    end

    it "writes it in the audit log, without the secret" do
      save(oidc_form)

      log = ActivityLog.where(action: "directory_settings.updated").last
      expect(log.metadata).to eq("oidc" => true, "ldap" => false)
    end

    it "takes effect on the sign-in screen at once" do
      save(oidc_form)

      get "/api/v1/auth/directory"

      expect(json_body["oidc"]["enabled"]).to be(true)
    end
  end

  describe "DELETE" do
    it "goes back to FixFlow passwords only" do
      save(oidc_form)

      delete "/api/v1/directory_settings", headers: headers

      expect(response).to have_http_status(:ok)
      expect(org.reload.directory_settings).to eq({})
      expect(ActivityLog.where(action: "directory_settings.removed")).to exist
    end

    it "leaves the people who signed in through the directory in place, and able to be given a password by an administrator" do
      save(oidc_form)
      person = create(:user, organization: org, identity_provider: "oidc", external_id: "x1")

      delete "/api/v1/directory_settings", headers: headers

      expect(person.reload).to be_persisted
    end
  end

  describe "POST /test" do
    it "checks an OpenID provider with the settings given, without saving them" do
      stub_provider

      post "/api/v1/directory_settings/test", params: { kind: "oidc", settings: oidc_form }, as: :json, headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("issuer" => DirectoryHelpers::ISSUER, "keys" => 1)
      expect(org.reload.directory_settings).to eq({})
    end

    it "tries the saved settings when none are given" do
      save(oidc_form)
      stub_provider

      post "/api/v1/directory_settings/test", params: { kind: "oidc", settings: {} }, as: :json, headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body["issuer"]).to eq(DirectoryHelpers::ISSUER)
    end

    it "says in words what is wrong when the provider cannot be reached" do
      stub_request(:get, "#{DirectoryHelpers::ISSUER}/.well-known/openid-configuration").to_timeout

      post "/api/v1/directory_settings/test", params: { kind: "oidc", settings: oidc_form }, as: :json, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("DIRECTORY_TEST_FAILED")
      expect(json_body.dig("error", "message")).to match(/Could not reach/)
    end

    it "uses the saved secret and the typed one over it" do
      save(oidc_form)
      stub_provider
      expect(Directory::Oidc).to receive(:new).with(have_attributes(oidc_client_id: "other", oidc_client_secret: "s3cret"))
                                               .at_least(:once).and_call_original

      post "/api/v1/directory_settings/test", params: { kind: "oidc", settings: { oidc_client_id: "other" } }, as: :json,
headers: headers
    end

    it "checks LDAP, and what the directory says about a person given, with the role they would get" do
      ldap = instance_double(Directory::Ldap)
      allow(Directory::Ldap).to receive(:new).and_return(ldap)
      allow(ldap).to receive(:check).and_return(host: "ldap.acme.test", people_found: 3)
      allow(ldap).to receive(:authenticate).with("jo", "jo-pass").and_return(
        Directory::Identity.new(provider: "ldap", subject: "u", email: "jo@acme.test", first_name: "Jo", last_name: "Reyes",
groups: ["cn=admins,dc=x"])
      )
      form = { ldap_host: "ldap.acme.test", ldap_user_base: "ou=people", role_groups: { admin: "admins" } }

      post "/api/v1/directory_settings/test", params: { kind: "ldap", settings: form, login: "jo", password: "jo-pass" }, as: :json,
headers: headers

      expect(json_body).to include("people_found" => 3)
      expect(json_body["person"]).to include("found" => true, "email" => "jo@acme.test", "role" => "admin",
"groups" => ["cn=admins,dc=x"])
    end

    it "says the person was not found, when the login or password is wrong" do
      ldap = instance_double(Directory::Ldap, check: { people_found: 1 }, authenticate: nil)
      allow(Directory::Ldap).to receive(:new).and_return(ldap)

      form = { kind: "ldap", settings: { ldap_host: "h", ldap_user_base: "b" }, login: "jo", password: "x" }
      post "/api/v1/directory_settings/test", params: form, as: :json, headers: headers

      expect(json_body["person"]).to eq("found" => false)
    end

    it "does not keep, or log, the password typed to try a person" do
      ldap = instance_double(Directory::Ldap, check: {}, authenticate: nil)
      allow(Directory::Ldap).to receive(:new).and_return(ldap)

      form = { kind: "ldap", settings: { ldap_host: "h", ldap_user_base: "b" }, login: "jo", password: "hunter2-typed" }
      post "/api/v1/directory_settings/test", params: form, as: :json, headers: headers

      expect(org.reload.directory_settings.to_json).not_to include("hunter2-typed")
      expect(ActivityLog.all.map(&:metadata).to_json).not_to include("hunter2-typed")
    end

    it "wants to know which kind to try" do
      post "/api/v1/directory_settings/test", params: { kind: "saml", settings: {} }, as: :json, headers: headers

      expect(response).to have_http_status(:bad_request)
    end

    it "asks for the first settings before trying, rather than calling a server with nothing" do
      post "/api/v1/directory_settings/test", params: { kind: "ldap", settings: { ldap_enabled: false } }, as: :json, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
