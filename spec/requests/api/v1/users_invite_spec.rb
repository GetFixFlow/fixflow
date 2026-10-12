require "rails_helper"

RSpec.describe "Api::V1::Users invitations", type: :request do
  let(:org)     { create(:organization) }
  let!(:admin)   { create(:user, :admin,   organization: org) }
  let!(:manager) { create(:user, :manager, organization: org) }

  let(:invite_params) do
    { user: { email: "newhire@acme.com", first_name: "Nina", last_name: "Hire",
              role: "technician", send_welcome: true, message: "Welcome aboard" } }
  end

  def token_from(url)
    Rack::Utils.parse_query(URI(url).query)["token"]
  end

  describe "POST /api/v1/users/invite" do
    it "creates a pending user in the admin's organization and returns the link" do
      expect {
        post "/api/v1/users/invite", params: invite_params, headers: auth_headers_for(admin), as: :json
      }.to change { org.users.count }.by(1)

      expect(response).to have_http_status(:created)
      user = User.find_by!(email: "newhire@acme.com")
      expect(user.organization_id).to eq(org.id)
      expect(user.role).to eq("technician")
      expect(user.invited_by_id).to eq(admin.id)
      expect(user).to be_invitation_pending

      expect(json_body["invitation_url"]).to include("/accept-invite?token=")
      expect(json_body["user"]["invitation_pending"]).to be true
      expect(json_body["user"]["invitation_accepted_at"]).to be_nil
    end

    it "stores only a digest of the token" do
      post "/api/v1/users/invite", params: invite_params, headers: auth_headers_for(admin), as: :json

      raw = token_from(json_body["invitation_url"])
      user = User.find_by!(email: "newhire@acme.com")
      expect(user.invitation_token_digest).to be_present
      expect(user.invitation_token_digest).not_to include(raw)
      expect(User.find_by_invitation_token(raw)).to eq(user)
    end

    it "emails the invitation when send_welcome is on and email is set up" do
      expect {
        post "/api/v1/users/invite", params: invite_params, headers: auth_headers_for(admin), as: :json
      }.to have_enqueued_mail(InvitationMailer, :invite)

      expect(json_body["email_sent"]).to be true
    end

    it "does not email when send_welcome is off, but still returns the link" do
      params = invite_params.deep_merge(user: { send_welcome: false })

      expect {
        post "/api/v1/users/invite", params: params, headers: auth_headers_for(admin), as: :json
      }.not_to have_enqueued_mail(InvitationMailer, :invite)

      expect(json_body["email_sent"]).to be false
      expect(json_body["invitation_url"]).to be_present
    end

    it "does not email when mail is not set up, but still returns the link" do
      allow(Invitations).to receive(:email_configured?).and_return(false)

      expect {
        post "/api/v1/users/invite", params: invite_params, headers: auth_headers_for(admin), as: :json
      }.not_to have_enqueued_mail(InvitationMailer, :invite)

      expect(json_body["email_sent"]).to be false
      expect(json_body["invitation_url"]).to be_present
    end

    it "forbids a manager and creates nobody" do
      expect {
        post "/api/v1/users/invite", params: invite_params, headers: auth_headers_for(manager), as: :json
      }.not_to change(User, :count)

      expect(response).to have_http_status(:forbidden)
    end

    it "requires authentication" do
      post "/api/v1/users/invite", params: invite_params, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects an email that is already in use" do
      create(:user, email: "newhire@acme.com")

      expect {
        post "/api/v1/users/invite", params: invite_params, headers: auth_headers_for(admin), as: :json
      }.not_to change(User, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "rejects an unknown role" do
      params = invite_params.deep_merge(user: { role: "superuser" })
      post "/api/v1/users/invite", params: params, headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(User.find_by(email: "newhire@acme.com")).to be_nil
    end

    it "gives the invited user no usable password before they accept" do
      post "/api/v1/users/invite", params: invite_params, as: :json, headers: auth_headers_for(admin)

      reset! # drop the admin's session cookie so this really tries the invited user
      post "/api/v1/auth/sign_in", params: { user: { email: "newhire@acme.com", password: "password123" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(User.find_by!(email: "newhire@acme.com").valid_password?("password123")).to be false
    end
  end

  describe "POST /api/v1/users/:id/resend_invitation" do
    let!(:invited) do
      create(:user, organization: org).tap { |u| u.invite!(invited_by: admin) }
    end

    it "issues a new link and invalidates the old one" do
      old_token = "old-token"
      invited.update!(invitation_token_digest: User.invitation_digest(old_token))

      post "/api/v1/users/#{invited.id}/resend_invitation", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:ok)
      new_token = token_from(json_body["invitation_url"])
      expect(User.find_by_invitation_token(new_token)).to eq(invited)
      expect(User.find_by_invitation_token(old_token)).to be_nil
    end

    it "refuses once the invitation was accepted" do
      invited.accept_invitation!(password: "newpassword1", password_confirmation: "newpassword1")

      post "/api/v1/users/#{invited.id}/resend_invitation", headers: auth_headers_for(admin), as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "forbids a manager" do
      post "/api/v1/users/#{invited.id}/resend_invitation", headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "cannot reach a user in another organization" do
      other = create(:user)
      post "/api/v1/users/#{other.id}/resend_invitation", headers: auth_headers_for(admin), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/users (status fields)" do
    it "marks invited users as pending and people who signed up as accepted" do
      signed_up = create(:user, organization: org)
      invited   = create(:user, organization: org).tap { |u| u.invite!(invited_by: admin) }

      get "/api/v1/users", headers: auth_headers_for(admin), as: :json

      rows = json_body["users"].index_by { |u| u["id"] }
      expect(rows[invited.id]["invitation_pending"]).to be true
      expect(rows[invited.id]["invitation_accepted_at"]).to be_nil
      expect(rows[signed_up.id]["invitation_pending"]).to be false
      expect(rows[signed_up.id]["invitation_accepted_at"]).to be_present
    end
  end
end
