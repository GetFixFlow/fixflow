require "rails_helper"

RSpec.describe "Auth::Registrations", type: :request do
  describe "POST /api/v1/auth/sign_up" do
    let(:valid_params) do
      {
        user: {
          email: "admin@acme.com",
          password: "securepass1",
          password_confirmation: "securepass1",
          first_name: "Jane",
          last_name: "Smith",
          organization_name: "Acme Corp"
        }
      }
    end

    context "with valid params" do
      it "creates a new organization and admin user, returns 201" do
        expect {
          post "/api/v1/auth/sign_up", params: valid_params, as: :json
        }.to change(Organization, :count).by(1).and change(User, :count).by(1)

        expect(response).to have_http_status(:created)
        expect(json_body["message"]).to eq("Account created successfully")
        expect(json_body["user"]["email"]).to eq("admin@acme.com")
        expect(json_body["user"]["role"]).to eq("admin")
      end

      it "returns a JWT in the Authorization header" do
        post "/api/v1/auth/sign_up", params: valid_params, as: :json
        expect(response.headers["Authorization"]).to match(/\ABearer /)
      end
    end

    context "with a duplicate email" do
      before { create(:user, email: "admin@acme.com") }

      it "returns 422 and leaves no orphaned organization" do
        expect {
          post "/api/v1/auth/sign_up", params: valid_params, as: :json
        }.not_to change(Organization, :count)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_body).to have_key("errors")
      end
    end

    context "with missing required fields" do
      it "returns 422" do
        post "/api/v1/auth/sign_up",
          params: { user: { email: "bad@example.com", password: "short" } },
          as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json_body).to have_key("errors")
      end
    end

    context "without an organization_name" do
      it "returns 422 because organization is invalid" do
        post "/api/v1/auth/sign_up",
          params: { user: valid_params[:user].except(:organization_name) },
          as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end
end
