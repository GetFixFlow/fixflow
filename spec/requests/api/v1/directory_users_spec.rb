require "rails_helper"

# What changes for a person who signs in through the company directory, in the rest of the app.
RSpec.describe "People who sign in through the directory", type: :request do
  let(:org)   { create(:organization) }
  let(:admin) { create(:user, :admin, organization: org) }
  let(:person) { create(:user, organization: org, identity_provider: "oidc", external_id: "ext-1") }

  before { oidc_settings.save_to(org) }

  def headers_for(user)
    code = Directory::LoginCode.issue(user)
    allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)
    post "/api/v1/auth/directory", params: { code: code }, as: :json
    { "Authorization" => response.headers["Authorization"] }
  end

  it "shows how they sign in, in the user lists" do
    get "/api/v1/users", headers: auth_headers_for(admin)

    expect(response).to have_http_status(:ok)
    expect(json_body["users"].pluck("identity_provider").uniq).to eq([nil])

    person
    get "/api/v1/users", headers: auth_headers_for(admin)
    expect(json_body["users"].find { |u| u["id"] == person.id }["identity_provider"]).to eq("oidc")
  end

  describe "the role" do
    it "cannot be changed by hand while it follows the groups, and the reason is given" do
      patch "/api/v1/users/#{person.id}/role", params: { role: "manager" }, as: :json, headers: auth_headers_for(admin)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to match(/follows their groups/)
      expect(person.reload.role).to eq("technician")
    end

    it "can be changed by hand once the company turns off following the groups" do
      oidc_settings(sync_roles: false).save_to(org)

      patch "/api/v1/users/#{person.id}/role", params: { role: "manager" }, as: :json, headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(person.reload.role).to eq("manager")
    end

    it "can still be changed for a person who signs in with a password" do
      local = create(:user, organization: org)

      patch "/api/v1/users/#{local.id}/role", params: { role: "manager" }, as: :json, headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
    end
  end

  describe "the password" do
    it "is kept by the directory: it cannot be changed here" do
      change = { current_password: "x", password: "a-long-new-password", password_confirmation: "a-long-new-password" }
      patch "/api/v1/profile/password", params: { user: change }, as: :json, headers: headers_for(person)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("DIRECTORY_PASSWORD")
    end

    it "gets no reset link, though anyone may ask for one" do
      post "/api/v1/auth/password", params: { user: { email: person.email } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(person.reload.reset_password_token).to be_nil
    end
  end

  describe "two-factor sign-in" do
    it "is not demanded of them when the company requires it: the directory asks for the second factor" do
      org.update!(settings: org.settings.merge("require_two_factor" => true))
      headers = headers_for(person)

      expect(json_body["user"]["two_factor_setup_required"]).to be(false)
      get "/api/v1/work_orders", headers: headers

      expect(response).to have_http_status(:ok)
    end

    it "is still demanded of a person with a FixFlow password" do
      org.update!(settings: org.settings.merge("require_two_factor" => true))
      local = create(:user, organization: org)

      get "/api/v1/work_orders", headers: auth_headers_for(local)

      expect(response).to have_http_status(:forbidden)
      expect(json_body.dig("error", "code")).to eq("TWO_FACTOR_SETUP_REQUIRED")
    end
  end
end
