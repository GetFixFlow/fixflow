require "rails_helper"

RSpec.describe "People who joined the directory, once the company turns it off", type: :request do
  let(:org)    { create(:organization) }
  let(:admin)  { create(:user, :admin, organization: org) }
  let!(:person) { create(:user, organization: org, identity_provider: "oidc", external_id: "ext-1") }

  before { oidc_settings.save_to(org) }

  it "stops being shown as signing in through the directory, and gets a reset link like anyone" do
    org.update!(directory_settings: {})

    get "/api/v1/users", headers: auth_headers_for(admin)
    expect(json_body["users"].find { |u| u["id"] == person.id }["identity_provider"]).to be_nil

    post "/api/v1/users/#{person.id}/reset_password", headers: auth_headers_for(admin)
    expect(response).to have_http_status(:ok)
    expect(json_body["reset_url"]).to include("/reset-password?token=")
  end

  it "has no reset link while the directory is on" do
    post "/api/v1/users/#{person.id}/reset_password", headers: auth_headers_for(admin)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json_body.dig("error", "message")).to match(/company directory, which keeps their password/)
  end

  it "can be given a role by hand again" do
    org.update!(directory_settings: {})

    patch "/api/v1/users/#{person.id}/role", params: { role: "manager" }, as: :json, headers: auth_headers_for(admin)

    expect(response).to have_http_status(:ok)
  end

  it "can sign in with the password a reset link gave them, and is joined to the directory again by it once it is on" do
    org.update!(directory_settings: {})
    person.update!(password: "a-new-password-for-sam", password_confirmation: "a-new-password-for-sam", skip_password_policy: true)

    post "/api/v1/auth/sign_in", params: { user: { email: person.email, password: "a-new-password-for-sam" } }, as: :json

    expect(response).to have_http_status(:ok)
  end
end
