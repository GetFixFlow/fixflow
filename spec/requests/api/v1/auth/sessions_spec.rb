require "rails_helper"

RSpec.describe "Auth::Sessions", type: :request do
  let(:org)  { create(:organization) }
  let(:user) { create(:user, organization: org) }

  describe "POST /api/v1/auth/sign_in" do
    context "with valid credentials" do
      it "returns 200 and a JWT in the Authorization header" do
        post "/api/v1/auth/sign_in",
          params: { user: { email: user.email, password: "password123" } },
          as: :json

        expect(response).to have_http_status(:ok)
        expect(response.headers["Authorization"]).to match(/\ABearer /)
        expect(json_body["message"]).to eq("Logged in successfully")
        expect(json_body["user"]["id"]).to eq(user.id)
        expect(json_body["user"]["email"]).to eq(user.email)
        expect(json_body["user"]["role"]).to eq(user.role)
        expect(json_body["user"]["organization_id"]).to eq(org.id)
      end
    end

    context "with wrong password" do
      it "returns 401" do
        post "/api/v1/auth/sign_in",
          params: { user: { email: user.email, password: "wrongpassword" } },
          as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with unknown email" do
      it "returns 401" do
        post "/api/v1/auth/sign_in",
          params: { user: { email: "nobody@example.com", password: "password123" } },
          as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "DELETE /api/v1/auth/sign_out" do
    context "with a valid JWT" do
      it "returns 200 and revokes the token" do
        headers = auth_headers_for(user)
        delete "/api/v1/auth/sign_out", headers: headers, as: :json

        expect(response).to have_http_status(:ok)
        expect(json_body["message"]).to eq("Logged out successfully")
      end

      it "rejects subsequent requests with the same (revoked) token" do
        headers = auth_headers_for(user)
        delete "/api/v1/auth/sign_out", headers: headers, as: :json

        get "/api/v1/auth/me", headers: headers, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "without a token" do
      it "returns 401" do
        delete "/api/v1/auth/sign_out", as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
