require "rails_helper"

RSpec.describe "Setup", type: :request do
  describe "GET /api/v1/setup/status" do
    it "reports setup is required on a fresh install, without authentication" do
      get "/api/v1/setup/status"

      expect(response).to have_http_status(:ok)
      expect(json_body["setup_required"]).to be(true)
    end

    it "reports setup is complete once a company exists" do
      create(:organization)

      get "/api/v1/setup/status"

      expect(response).to have_http_status(:ok)
      expect(json_body["setup_required"]).to be(false)
    end

    it "flips to complete after the first sign-up" do
      post "/api/v1/auth/sign_up", as: :json, params: {
        user: { email: "admin@acme.com", password: "securepass1", password_confirmation: "securepass1",
                first_name: "Jane", last_name: "Smith", organization_name: "Acme Corp" }
      }
      expect(response).to have_http_status(:created)

      get "/api/v1/setup/status"
      expect(json_body["setup_required"]).to be(false)
    end
  end
end
