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

    context "when setup is already complete" do
      before { create(:organization) }

      it "returns 403 and creates no organization or user" do
        expect {
          post "/api/v1/auth/sign_up", params: valid_params, as: :json
        }.not_to change { [Organization.count, User.count] }

        expect(response).to have_http_status(:forbidden)
        expect(json_body["code"]).to eq("SETUP_COMPLETE")
        expect(json_body["errors"]).to be_present
      end

      it "does not return a JWT" do
        post "/api/v1/auth/sign_up", params: valid_params, as: :json
        expect(response.headers["Authorization"]).to be_blank
      end
    end

    context "with an invalid user on a fresh install" do
      it "leaves no orphaned organization behind" do
        invalid = valid_params.deep_merge(user: { password_confirmation: "different" })

        expect {
          post "/api/v1/auth/sign_up", params: invalid, as: :json
        }.not_to change(Organization, :count)

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context "when a second sign-up follows the first" do
      it "lets only the first create a company" do
        post "/api/v1/auth/sign_up", params: valid_params, as: :json
        expect(response).to have_http_status(:created)

        second = valid_params.deep_merge(user: { email: "other@acme.com", organization_name: "Other Co" })
        expect {
          post "/api/v1/auth/sign_up", params: second, as: :json
        }.not_to change(Organization, :count)

        expect(response).to have_http_status(:forbidden)
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

  # Devise's other registration routes (change or delete your own account by PUT, PATCH and DELETE) are not drawn: a person
  # changes their details in My Profile and an administrator removes people, with the safeguards that go with it.
  describe "the other registration routes" do
    let(:org)  { create(:organization) }
    let(:user) { create(:user, :manager, organization: org) }

    it "offers no way to change or delete one's own account through sign_up" do
      headers = auth_headers_for(user)

      put "/api/v1/auth/sign_up", params: { user: { email: "new@example.com", current_password: "password123" } },
                                  headers: headers, as: :json
      expect(response).to have_http_status(:not_found)
      patch "/api/v1/auth/sign_up", params: { user: { email: "new@example.com" } }, headers: headers, as: :json
      expect(response).to have_http_status(:not_found)
      delete "/api/v1/auth/sign_up", headers: headers, as: :json
      expect(response).to have_http_status(:not_found)

      expect(user.reload.email).not_to eq("new@example.com")
      expect(User.exists?(user.id)).to be(true)
    end

    it "starts no cookie session when it creates the first administrator" do
      Organization.destroy_all
      post "/api/v1/auth/sign_up", params: { user: { email: "first@example.com", password: "a long unusual passphrase 42",
                                                      password_confirmation: "a long unusual passphrase 42", first_name: "First",
                                                      last_name: "Admin", organization_name: "Acme" } }, as: :json

      expect(response).to have_http_status(:created)
      expect(response.headers["Authorization"]).to match(/\ABearer /)
      expect(cookies["_fixflow_session"]).to be_blank
    end
  end
end
