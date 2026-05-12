require "rails_helper"

RSpec.describe "Auth", type: :request do
  let(:org)  { create(:organization) }
  let(:user) { create(:user, organization: org) }

  # ─── POST /api/v1/auth/sign_up ─────────────────────────────────────────────

  describe "POST /api/v1/auth/sign_up" do
    let(:valid_params) do
      {
        user: {
          email: "founder@startup.io",
          password: "Password1!",
          password_confirmation: "Password1!",
          first_name: "Alice",
          last_name: "Founder",
          organization_name: "Startup Inc"
        }
      }
    end

    it "creates organization + admin user and returns 201 with JWT" do
      expect {
        post "/api/v1/auth/sign_up", params: valid_params, as: :json
      }.to change(Organization, :count).by(1).and change(User, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(response.headers["Authorization"]).to match(/\ABearer /)
      expect(json_body["user"]["email"]).to eq("founder@startup.io")
      expect(json_body["user"]["role"]).to eq("admin")
    end

    it "returns 422 when email is already taken" do
      create(:user, email: "founder@startup.io")
      post "/api/v1/auth/sign_up", params: valid_params, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["errors"]).to be_present
    end

    it "returns 422 when password confirmation does not match" do
      params = valid_params.deep_merge(user: { password_confirmation: "different" })
      post "/api/v1/auth/sign_up", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "returns 422 when organization_name is blank" do
      params = valid_params.deep_merge(user: { organization_name: "" })
      post "/api/v1/auth/sign_up", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  # ─── POST /api/v1/auth/sign_in ─────────────────────────────────────────────

  describe "POST /api/v1/auth/sign_in" do
    it "returns 200, user payload, and Bearer JWT on valid credentials" do
      post "/api/v1/auth/sign_in",
        params: { user: { email: user.email, password: "password123" } },
        as: :json

      expect(response).to have_http_status(:ok)
      expect(response.headers["Authorization"]).to match(/\ABearer /)
      expect(json_body["message"]).to eq("Logged in successfully")
      expect(json_body["user"]["id"]).to eq(user.id)
      expect(json_body["user"]["email"]).to eq(user.email)
      expect(json_body["user"]["full_name"]).to eq(user.full_name)
      expect(json_body["user"]["organization_id"]).to eq(org.id)
    end

    it "returns 401 with wrong password" do
      post "/api/v1/auth/sign_in",
        params: { user: { email: user.email, password: "wrong" } },
        as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 401 with unknown email" do
      post "/api/v1/auth/sign_in",
        params: { user: { email: "ghost@example.com", password: "password123" } },
        as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  # ─── DELETE /api/v1/auth/sign_out ──────────────────────────────────────────

  describe "DELETE /api/v1/auth/sign_out" do
    it "returns 200 and revokes the JWT" do
      headers = auth_headers_for(user)
      delete "/api/v1/auth/sign_out", headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["message"]).to eq("Logged out successfully")
    end

    it "revoked token is rejected on subsequent requests" do
      headers = auth_headers_for(user)
      delete "/api/v1/auth/sign_out", headers: headers, as: :json

      get "/api/v1/auth/me", headers: headers, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 401 when called without a token" do
      delete "/api/v1/auth/sign_out", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  # ─── GET /api/v1/auth/me ───────────────────────────────────────────────────

  describe "GET /api/v1/auth/me" do
    it "returns the current user profile when authenticated" do
      get "/api/v1/auth/me", headers: auth_headers_for(user), as: :json

      expect(response).to have_http_status(:ok)
      expect(json_body["id"]).to eq(user.id)
      expect(json_body["email"]).to eq(user.email)
      expect(json_body["role"]).to eq(user.role)
      expect(json_body["full_name"]).to eq(user.full_name)
      expect(json_body["organization_id"]).to eq(org.id)
    end

    it "returns 401 when not authenticated" do
      get "/api/v1/auth/me", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 401 when Authorization header is malformed" do
      get "/api/v1/auth/me",
        headers: { "Authorization" => "Bearer not-a-real-token" },
        as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  # ─── General 401 guard on protected endpoints ──────────────────────────────

  describe "unauthenticated access to protected resources" do
    it "returns 401 for GET /api/v1/users without token" do
      get "/api/v1/users", as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 401 for GET /api/v1/assets without token" do
      get "/api/v1/assets", as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
