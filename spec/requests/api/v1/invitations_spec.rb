require "rails_helper"

RSpec.describe "Api::V1::Invitations", type: :request do
  let(:org)   { create(:organization, name: "Acme Corp") }
  let(:admin) { create(:user, :admin, organization: org) }
  let!(:user) { create(:user, organization: org, role: "manager", first_name: "Nina", last_name: "Hire") }
  let!(:raw_token) { user.invite!(invited_by: admin) }

  let(:accept_params) do
    { user: { password: "newpassword1", password_confirmation: "newpassword1" } }
  end

  describe "GET /api/v1/invitations/:token" do
    it "shows who is invited, without authentication" do
      get "/api/v1/invitations/#{raw_token}"

      expect(response).to have_http_status(:ok)
      expect(json_body).to include(
        "email" => user.email, "first_name" => "Nina", "last_name" => "Hire",
        "role" => "manager", "organization_name" => "Acme Corp"
      )
    end

    it "does not reveal anything beyond what the invitee needs" do
      get "/api/v1/invitations/#{raw_token}"
      expect(json_body.keys).to match_array(%w[email first_name last_name role organization_name])
    end

    it "returns 404 for an unknown token" do
      get "/api/v1/invitations/not-a-real-token"

      expect(response).to have_http_status(:not_found)
      expect(json_body.dig("error", "code")).to eq("INVITATION_INVALID")
    end

    it "returns the same 404 once the invitation has expired" do
      travel_to(User::INVITATION_TTL.from_now + 1.minute) do
        get "/api/v1/invitations/#{raw_token}"

        expect(response).to have_http_status(:not_found)
        expect(json_body.dig("error", "code")).to eq("INVITATION_INVALID")
      end
    end
  end

  describe "POST /api/v1/invitations/:token/accept" do
    it "sets the password so the user can sign in" do
      post "/api/v1/invitations/#{raw_token}/accept", params: accept_params, as: :json
      expect(response).to have_http_status(:ok)

      post "/api/v1/auth/sign_in", params: { user: { email: user.email, password: "newpassword1" } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.headers["Authorization"]).to match(/\ABearer /)
    end

    it "keeps the role and organization chosen by the admin" do
      post "/api/v1/invitations/#{raw_token}/accept", params: accept_params, as: :json

      user.reload
      expect(user.role).to eq("manager")
      expect(user.organization_id).to eq(org.id)
      expect(user.invitation_accepted_at).to be_present
      expect(user).not_to be_invitation_pending
    end

    it "works only once" do
      post "/api/v1/invitations/#{raw_token}/accept", params: accept_params, as: :json
      post "/api/v1/invitations/#{raw_token}/accept",
        params: { user: { password: "another-pass1", password_confirmation: "another-pass1" } }, as: :json

      expect(response).to have_http_status(:not_found)
      post "/api/v1/auth/sign_in", params: { user: { email: user.email, password: "another-pass1" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects mismatched passwords and leaves the invitation usable" do
      params = { user: { password: "newpassword1", password_confirmation: "different1" } }
      post "/api/v1/invitations/#{raw_token}/accept", params: params, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["errors"]).to be_present
      expect(user.reload).to be_invitation_pending
    end

    it "rejects a blank password" do
      post "/api/v1/invitations/#{raw_token}/accept",
        params: { user: { password: "", password_confirmation: "" } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload).to be_invitation_pending
    end

    it "does not accept after the invitation expired" do
      travel_to(User::INVITATION_TTL.from_now + 1.minute) do
        post "/api/v1/invitations/#{raw_token}/accept", params: accept_params, as: :json
        expect(response).to have_http_status(:not_found)
      end
    end

    it "does not accept for an unknown token" do
      post "/api/v1/invitations/nope/accept", params: accept_params, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end
end
