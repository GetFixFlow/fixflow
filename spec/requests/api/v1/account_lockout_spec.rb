require "rails_helper"

RSpec.describe "Locking an account after wrong passwords", type: :request do
  let(:org)   { create(:organization) }
  let(:user)  { create(:user, organization: org) }
  let(:admin) { create(:user, :admin, organization: org) }

  def sign_in_with(password, email: user.email)
    post "/api/v1/auth/sign_in", params: { user: { email: email, password: password } }, as: :json
  end

  def wrong(times) = times.times { sign_in_with("not the password") }

  it "refuses even the right password after ten wrong ones, and says why" do
    wrong(10)
    sign_in_with("password123")

    expect(response).to have_http_status(:unauthorized)
    expect(response.headers["Authorization"]).to be_nil
    expect(json_body["error"]).to include("Too many wrong passwords", "30 minutes")
    expect(user.reload).to be_access_locked
  end

  it "writes the lock to the audit log, once" do
    wrong(12)

    expect(ActivityLog.where(action: "user.locked", resource_id: user.id).count).to eq(1)
  end

  it "does not lock after nine wrong ones, and the right password signs in and starts the count again" do
    wrong(9)
    sign_in_with("password123")
    expect(response).to have_http_status(:ok)
    expect(user.reload.failed_attempts).to eq(0)

    wrong(9)
    sign_in_with("password123")
    expect(response).to have_http_status(:ok)
  end

  it "opens by itself after 30 minutes, and not before" do
    wrong(10)

    travel(29.minutes) do
      sign_in_with("password123")
      expect(response).to have_http_status(:unauthorized)
    end
    travel(31.minutes) do
      sign_in_with("password123")
      expect(response).to have_http_status(:ok)
      expect(user.reload).not_to be_access_locked
    end
  end

  it "locks only that account, and wrong tries for an unknown email lock nothing and fail like any other" do
    other = create(:user, organization: org)
    wrong(10)
    sign_in_with("password123", email: other.email)
    expect(response).to have_http_status(:ok)

    5.times { sign_in_with("whatever", email: "nobody@example.test") }
    expect(response).to have_http_status(:unauthorized)
    expect(json_body["error"]).not_to include("Too many")
  end

  describe "for a person who signs in with an authenticator app" do
    before { enable_two_factor_for(user) }

    it "counts wrong passwords, and a locked account gets no challenge even with the right one" do
      wrong(10)
      sign_in_with("password123")

      expect(response).to have_http_status(:unauthorized)
      expect(json_body).not_to have_key("challenge")
      expect(json_body["error"]).to include("Too many wrong passwords")
    end

    it "starts the count of wrong passwords again once the second step has signed the person in" do
      wrong(9)
      sign_in_with("password123")
      expect(json_body).to have_key("challenge")

      post "/api/v1/auth/two_factor", params: { challenge: json_body["challenge"], code: code_for(user) }, as: :json
      expect(response).to have_http_status(:ok)
      expect(user.reload.failed_attempts).to eq(0)
    end
  end

  describe "POST /api/v1/users/:id/unlock" do
    before { wrong(10) }

    it "lets an administrator open it at once, and says so in the audit log" do
      post "/api/v1/users/#{user.id}/unlock", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json_body["user"]["locked"]).to be(false)
      expect(ActivityLog.where(action: "user.unlocked", resource_id: user.id, user_id: admin.id).count).to eq(1)
      sign_in_with("password123")
      expect(response).to have_http_status(:ok)
    end

    it "is for administrators" do
      manager = create(:user, :manager, organization: org)
      post "/api/v1/users/#{user.id}/unlock", headers: auth_headers_for(manager)

      expect(response).to have_http_status(:forbidden)
      expect(user.reload).to be_access_locked
    end

    it "is refused for a person who is not locked and for another company's person" do
      other = create(:user, organization: org)
      post "/api/v1/users/#{other.id}/unlock", headers: auth_headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)

      stranger = create(:user)
      post "/api/v1/users/#{stranger.id}/unlock", headers: auth_headers_for(admin)
      expect(response).to have_http_status(:not_found)
    end

    it "shows who is locked in the list of people" do
      get "/api/v1/users", headers: auth_headers_for(admin)

      locked = json_body["users"].to_h { |person| [person["id"], person["locked"]] }
      expect(locked).to include(user.id => true, admin.id => false)
    end
  end
end
