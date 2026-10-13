require "rails_helper"

RSpec.describe "Password reset", type: :request do
  let(:org)      { create(:organization) }
  let!(:admin)   { create(:user, :admin, organization: org) }
  let!(:tech)    { create(:user, organization: org, email: "tess@acme.com") }
  let(:new_pass) { "a-brand-new-pass1" }

  def token_from(url) = Rack::Utils.parse_query(URI(url).query)["token"]

  def reset_with(token, password: new_pass, confirmation: password)
    put "/api/v1/auth/password", as: :json,
      params: { user: { reset_password_token: token, password: password, password_confirmation: confirmation } }
  end

  describe "POST /api/v1/auth/password (forgot password)" do
    it "emails a reset link to a real account" do
      expect {
        post "/api/v1/auth/password", params: { user: { email: "tess@acme.com" } }, as: :json
      }.to have_enqueued_mail(PasswordMailer, :reset)

      expect(response).to have_http_status(:ok)
    end

    it "gives the same answer for an email nobody has, and sends nothing" do
      post "/api/v1/auth/password", params: { user: { email: "tess@acme.com" } }, as: :json
      known = response.parsed_body

      expect {
        post "/api/v1/auth/password", params: { user: { email: "nobody@acme.com" } }, as: :json
      }.not_to have_enqueued_mail(PasswordMailer, :reset)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq(known)
    end

    it "ignores capitalization and spaces in the email" do
      expect {
        post "/api/v1/auth/password", params: { user: { email: "  Tess@Acme.com " } }, as: :json
      }.to have_enqueued_mail(PasswordMailer, :reset)
    end

    it "sends nothing to a deactivated person" do
      UserAdministration.deactivate!(tech, by: admin)

      expect {
        post "/api/v1/auth/password", params: { user: { email: "tess@acme.com" } }, as: :json
      }.not_to have_enqueued_mail(PasswordMailer, :reset)
    end

    it "sends nothing to someone who has not accepted their invitation" do
      tech.invite!(invited_by: admin)

      expect {
        post "/api/v1/auth/password", params: { user: { email: "tess@acme.com" } }, as: :json
      }.not_to have_enqueued_mail(PasswordMailer, :reset)
    end

    it "sends nothing when the server cannot send email, but still answers the same" do
      allow(EmailSetup).to receive(:configured?).and_return(false)

      expect {
        post "/api/v1/auth/password", params: { user: { email: "tess@acme.com" } }, as: :json
      }.not_to have_enqueued_mail(PasswordMailer, :reset)

      expect(response).to have_http_status(:ok)
    end

    it "works without being signed in and without a password" do
      post "/api/v1/auth/password", params: { user: { email: "tess@acme.com" } }, as: :json
      expect(response).to have_http_status(:ok)
    end
  end

  describe "PUT /api/v1/auth/password (use the link)" do
    let(:link) { tech.reset_password_url }

    it "sets the new password so the person can sign in with it" do
      reset_with(token_from(link))
      expect(response).to have_http_status(:ok)

      reset!
      post "/api/v1/auth/sign_in", params: { user: { email: "tess@acme.com", password: new_pass } }, as: :json
      expect(response).to have_http_status(:ok)
    end

    it "retires the old password and every session started before the reset" do
      headers = auth_headers_for(tech)
      reset_with(token_from(link))

      get "/api/v1/profile", headers: headers
      expect(response).to have_http_status(:unauthorized)
      expect(tech.reload.valid_password?("password123")).to be false
    end

    it "works only once" do
      token = token_from(link)
      reset_with(token)
      reset_with(token, password: "another-pass-123")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(tech.reload.valid_password?(new_pass)).to be true
    end

    it "stops working when a newer link is issued" do
      old = token_from(link)
      tech.reset_password_url

      reset_with(old)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "expires" do
      token = token_from(link)

      travel_to(Devise.reset_password_within.from_now + 1.minute) do
        reset_with(token)
        expect(response).to have_http_status(:unprocessable_entity)
      end
      expect(tech.reload.valid_password?("password123")).to be true
    end

    it "rejects an unknown or missing token with the same message" do
      reset_with("not-a-token")
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("RESET_LINK_INVALID")

      put "/api/v1/auth/password", params: { user: { password: new_pass, password_confirmation: new_pass } }, as: :json
      expect(response).to have_http_status(:bad_request).or have_http_status(:unprocessable_entity)
    end

    it "rejects a short password or a mismatched confirmation, and keeps the link usable" do
      token = token_from(link)

      reset_with(token, password: "short")
      expect(response).to have_http_status(:unprocessable_entity)
      reset_with(token, password: new_pass, confirmation: "different-pass-1")
      expect(response).to have_http_status(:unprocessable_entity)

      reset_with(token)
      expect(response).to have_http_status(:ok)
    end

    it "does not reset a person who was deactivated after the link was sent" do
      token = token_from(link)
      UserAdministration.deactivate!(tech, by: admin)

      reset_with(token)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(tech.reload.valid_password?("password123")).to be true
    end
  end

  describe "POST /api/v1/users/:id/reset_password (admin)" do
    it "gives the admin a link that works, and emails it when email is set up" do
      expect {
        post "/api/v1/users/#{tech.id}/reset_password", headers: auth_headers_for(admin), as: :json
      }.to have_enqueued_mail(PasswordMailer, :reset)

      expect(response).to have_http_status(:ok)
      expect(json_body["email_sent"]).to be true

      reset_with(token_from(json_body["reset_url"]))
      expect(response).to have_http_status(:ok)
    end

    it "still returns the link, and says nothing was emailed, when email is not set up" do
      allow(EmailSetup).to receive(:configured?).and_return(false)

      expect {
        post "/api/v1/users/#{tech.id}/reset_password", headers: auth_headers_for(admin), as: :json
      }.not_to have_enqueued_mail(PasswordMailer, :reset)

      expect(json_body).to include("email_sent" => false)
      expect(json_body["reset_url"]).to include("/reset-password?token=")
    end

    it "leaves the person's password working until the link is used" do
      post "/api/v1/users/#{tech.id}/reset_password", headers: auth_headers_for(admin), as: :json
      expect(tech.reload.valid_password?("password123")).to be true
    end

    it "is for admins only" do
      manager = create(:user, :manager, organization: org)
      post "/api/v1/users/#{tech.id}/reset_password", headers: auth_headers_for(manager), as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "refuses yourself, a deactivated person, and someone with a pending invitation" do
      invited = create(:user, organization: org).tap { |u| u.invite!(invited_by: admin) }
      gone    = create(:user, organization: org).tap { |u| UserAdministration.deactivate!(u, by: admin) }
      headers = auth_headers_for(admin)

      [admin, invited, gone].each do |person|
        post "/api/v1/users/#{person.id}/reset_password", headers: headers, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    it "cannot reach someone in another company" do
      outsider = create(:user)
      post "/api/v1/users/#{outsider.id}/reset_password", headers: auth_headers_for(admin), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/setup/status" do
    it "says whether this server can send email, so the screen can say what to do" do
      allow(EmailSetup).to receive(:configured?).and_return(false)
      get "/api/v1/setup/status"
      expect(json_body["email_configured"]).to be false
    end
  end

  describe "throttling" do
    around do |example|
      original = Rack::Attack.cache.store
      Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
      Rack::Attack.reset!
      example.run
    ensure
      Rack::Attack.reset!
      Rack::Attack.cache.store = original
    end

    it "limits how often a link can be requested" do
      6.times { post "/api/v1/auth/password", params: { user: { email: "tess@acme.com" } }, as: :json }
      expect(response).to have_http_status(:too_many_requests)
    end
  end
end
