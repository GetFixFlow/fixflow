require "rails_helper"

RSpec.describe "Two-factor sign-in", type: :request do
  let(:org)  { create(:organization) }
  let(:user) { create(:user, organization: org) }

  def sign_in_with(email: user.email, password: "password123")
    post "/api/v1/auth/sign_in", params: { user: { email: email, password: password } }, as: :json
  end

  def second_step(code, challenge: json_body["challenge"])
    post "/api/v1/auth/two_factor", params: { challenge: challenge, code: code }, as: :json
  end

  context "when the person has not switched it on" do
    it "signs in with the password alone, as before" do
      sign_in_with

      expect(response).to have_http_status(:ok)
      expect(response.headers["Authorization"]).to match(/\ABearer /)
      expect(json_body).not_to have_key("two_factor_required")
    end
  end

  context "when the person has switched it on" do
    before { enable_two_factor_for(user) }

    it "answers the right password with a challenge, and starts no session" do
      expect { sign_in_with }.not_to change(UserSession, :count)

      expect(response).to have_http_status(:ok)
      expect(response.headers["Authorization"]).to be_nil
      expect(json_body).to include("two_factor_required" => true)
      expect(json_body["challenge"]).to be_present
      expect(json_body).not_to have_key("user")
    end

    it "answers a wrong password or an unknown email like anyone else: 401, no challenge" do
      sign_in_with(password: "not the password")
      expect(response).to have_http_status(:unauthorized)
      expect(json_body).not_to have_key("challenge")

      sign_in_with(email: "nobody@example.test")
      expect(response).to have_http_status(:unauthorized)
    end

    it "gives no challenge to a deactivated person" do
      user.update!(deactivated_at: Time.current)
      sign_in_with

      expect(response).to have_http_status(:unauthorized)
      expect(json_body).not_to have_key("challenge")
    end

    it "does not take a password sent as something else than text" do
      post "/api/v1/auth/sign_in", params: { user: { email: user.email, password: { x: 1 } } }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "signs in with the code from the app: a token, a session, and the person" do
      sign_in_with
      challenge = json_body["challenge"]

      expect { second_step(code_for(user), challenge: challenge) }.to change(UserSession, :count).by(1)

      expect(response).to have_http_status(:ok)
      expect(response.headers["Authorization"]).to match(/\ABearer /)
      expect(json_body["user"]).to include("id" => user.id, "two_factor_enabled" => true)

      get "/api/v1/auth/me", headers: { "Authorization" => response.headers["Authorization"] }
      expect(response).to have_http_status(:ok)
    end

    it "signs in with a recovery code once, and writes that to the audit log" do
      code = user.regenerate_recovery_codes!.first
      sign_in_with
      challenge = json_body["challenge"]

      second_step(code, challenge: challenge)
      expect(response).to have_http_status(:ok)
      expect(ActivityLog.where(action: "user.recovery_code_used", resource_id: user.id).count).to eq(1)

      second_step(code, challenge: challenge)
      expect(response).to have_http_status(:unauthorized)
    end

    it "refuses a wrong code: 401, no token, written to the audit log" do
      sign_in_with
      second_step("000000")

      expect(response).to have_http_status(:unauthorized)
      expect(response.headers["Authorization"]).to be_nil
      expect(json_body["code"]).to eq("TWO_FACTOR_INVALID")
      expect(ActivityLog.where(action: "user.two_factor_failed", resource_id: user.id).count).to eq(1)
    end

    it "locks after five wrong codes: 429, and the right code is refused too until it opens" do
      sign_in_with
      challenge = json_body["challenge"]
      5.times { second_step("000000", challenge: challenge) }

      second_step(code_for(user), challenge: challenge)
      expect(response).to have_http_status(:too_many_requests)
      expect(json_body["code"]).to eq("TWO_FACTOR_LOCKED")
      expect(response.headers["Authorization"]).to be_nil
      expect(ActivityLog.where(action: "user.two_factor_locked", resource_id: user.id)).to exist
    end

    it "opens again 15 minutes after the lock" do
      5.times { user.verify_second_factor!("000000") }

      travel 16.minutes do
        sign_in_with
        second_step(code_for(user))
        expect(response).to have_http_status(:ok)
      end
    end

    it "refuses a challenge that is old, forged, missing, or from before a password change" do
      sign_in_with
      challenge = json_body["challenge"]

      travel(6.minutes) { second_step(code_for(user), challenge: challenge) }
      expect(response).to have_http_status(:unauthorized)
      expect(json_body["code"]).to eq("TWO_FACTOR_CHALLENGE_INVALID")

      second_step(code_for(user), challenge: "#{challenge}x")
      expect(response).to have_http_status(:unauthorized)

      second_step(code_for(user), challenge: nil)
      expect(response).to have_http_status(:unauthorized)

      user.update!(jti: SecureRandom.uuid)
      second_step(code_for(user), challenge: challenge)
      expect(response).to have_http_status(:unauthorized)
    end

    it "refuses a challenge for a person who was deactivated after the password step" do
      sign_in_with
      challenge = json_body["challenge"]
      user.update!(deactivated_at: Time.current)

      second_step(code_for(user), challenge: challenge)
      expect(response).to have_http_status(:unauthorized)
    end

    it "does not let the code stand in for a password, or a challenge for someone else's code" do
      other = create(:user, organization: org)
      enable_two_factor_for(other)
      sign_in_with
      second_step(code_for(other))

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
