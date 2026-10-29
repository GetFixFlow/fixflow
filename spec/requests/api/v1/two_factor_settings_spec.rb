require "rails_helper"

RSpec.describe "Setting up two-factor sign-in", type: :request do
  let(:org)     { create(:organization) }
  let(:user)    { create(:user, organization: org) }
  let(:admin)   { create(:user, :admin, organization: org) }
  let(:headers) { auth_headers_for(user) }

  def status = json_body["two_factor"]

  describe "GET /api/v1/profile/two_factor" do
    it "says it is off, and whether the company requires it" do
      get "/api/v1/profile/two_factor", headers: headers

      expect(response).to have_http_status(:ok)
      expect(status).to include("enabled" => false, "recovery_codes_left" => 0, "required_by_company" => false)
    end

    it "needs a signed-in person" do
      get "/api/v1/profile/two_factor"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "the two calls that switch it on" do
    it "makes a secret, then switches on with the first code and shows the recovery codes once" do
      post "/api/v1/profile/two_factor", headers: headers
      expect(response).to have_http_status(:created)
      setup = json_body["setup"]
      expect(setup["otpauth_uri"]).to start_with("otpauth://totp/FixFlow:").and include("secret=#{setup['secret']}")
      expect(status["enabled"]).to be(false)

      post "/api/v1/profile/two_factor/confirm", params: { code: code_for(user) }, as: :json, headers: headers
      expect(response).to have_http_status(:ok)
      expect(status).to include("enabled" => true, "recovery_codes_left" => 10)
      expect(json_body["recovery_codes"].size).to eq(10)
      expect(ActivityLog.where(action: "user.two_factor_enabled", resource_id: user.id).count).to eq(1)

      get "/api/v1/profile/two_factor", headers: headers
      expect(json_body).not_to have_key("recovery_codes")
      expect(json_body.to_s).not_to include(setup["secret"])
    end

    it "does not switch on with a wrong code" do
      post "/api/v1/profile/two_factor", headers: headers
      post "/api/v1/profile/two_factor/confirm", params: { code: "000000" }, as: :json, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["code"]).to eq("TWO_FACTOR_INVALID")
      expect(user.reload).not_to be_two_factor_enabled
    end

    it "refuses to start again once it is on" do
      signed_in = headers
      enable_two_factor_for(user)
      post "/api/v1/profile/two_factor", headers: signed_in

      expect(response).to have_http_status(:conflict)
    end

    it "cannot be confirmed without starting" do
      post "/api/v1/profile/two_factor/confirm", params: { code: "123456" }, as: :json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "switching off and getting new recovery codes" do
    before { enable_two_factor_for(user) }

    let(:headers) { sign_in_with_second_step(user) }

    def sign_in_with_second_step(person)
      post "/api/v1/auth/sign_in", params: { user: { email: person.email, password: "password123" } }, as: :json
      post "/api/v1/auth/two_factor", params: { challenge: json_body["challenge"], code: code_for(person) }, as: :json
      person.reload.update!(otp_last_step: nil) # the next call may use this minute's code again
      { "Authorization" => response.headers["Authorization"] }
    end

    it "needs the password" do
      delete "/api/v1/profile/two_factor", params: { password: "wrong", code: code_for(user) }, as: :json, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["code"]).to eq("PASSWORD_INVALID")
      expect(user.reload).to be_two_factor_enabled
    end

    it "needs a current code or a recovery code" do
      delete "/api/v1/profile/two_factor", params: { password: "password123", code: "000000" }, as: :json, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["code"]).to eq("TWO_FACTOR_INVALID")
      expect(user.reload).to be_two_factor_enabled
    end

    it "switches off with both, and says so in the audit log" do
      delete "/api/v1/profile/two_factor", params: { password: "password123", code: code_for(user) }, as: :json, headers: headers

      expect(response).to have_http_status(:ok)
      expect(status["enabled"]).to be(false)
      expect(user.reload).not_to be_two_factor_enabled
      expect(ActivityLog.where(action: "user.two_factor_disabled", resource_id: user.id).count).to eq(1)
    end

    it "gives new recovery codes with both, and the old ones stop working" do
      old = user.regenerate_recovery_codes!.first
      post "/api/v1/profile/two_factor/recovery_codes", params: { password: "password123", code: code_for(user) }, as: :json,
                                                        headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body["recovery_codes"].size).to eq(10)
      expect(user.reload.verify_second_factor!(old)).to be(false)
    end

    it "locks after five wrong codes here too, with 429" do
      5.times do
        delete "/api/v1/profile/two_factor", params: { password: "password123", code: "000000" }, as: :json, headers: headers
      end
      delete "/api/v1/profile/two_factor", params: { password: "password123", code: code_for(user) }, as: :json, headers: headers

      expect(response).to have_http_status(:too_many_requests)
      expect(user.reload).to be_two_factor_enabled
    end
  end

  describe "a company that requires it" do
    before { org.update!(settings: { "require_two_factor" => true }) }

    it "lets a person without it reach only the set-up and their own details" do
      get "/api/v1/work_orders", headers: headers
      expect(response).to have_http_status(:forbidden)
      expect(json_body["error"]["code"]).to eq("TWO_FACTOR_SETUP_REQUIRED")

      get "/api/v1/auth/me", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json_body).to include("two_factor_setup_required" => true, "two_factor_enabled" => false)

      get "/api/v1/profile", headers: headers
      expect(response).to have_http_status(:ok)

      get "/api/v1/profile/two_factor", headers: headers
      expect(status["required_by_company"]).to be(true)
    end

    it "lets them in once it is set up" do
      post "/api/v1/profile/two_factor", headers: headers
      post "/api/v1/profile/two_factor/confirm", params: { code: code_for(user) }, as: :json, headers: headers
      get "/api/v1/work_orders", headers: headers

      expect(response).to have_http_status(:ok)
      get "/api/v1/auth/me", headers: headers
      expect(json_body).to include("two_factor_setup_required" => false, "two_factor_enabled" => true)
    end

    it "does not touch another company" do
      other = create(:user)
      get "/api/v1/work_orders", headers: auth_headers_for(other)

      expect(response).to have_http_status(:ok)
    end
  end

  describe "the company setting" do
    it "is off by default, and changed by an administrator only" do
      get "/api/v1/organization_settings", headers: auth_headers_for(admin)
      expect(json_body["organization"]["require_two_factor"]).to be(false)

      patch "/api/v1/organization_settings", params: { organization: { require_two_factor: true } }, as: :json, headers: headers
      expect(response).to have_http_status(:forbidden)

      patch "/api/v1/organization_settings", params: { organization: { require_two_factor: true } }, as: :json,
                                             headers: auth_headers_for(admin)
      expect(response).to have_http_status(:ok)
      expect(org.reload).to be_require_two_factor
    end
  end

  describe "POST /api/v1/users/:id/reset_two_factor" do
    before { enable_two_factor_for(user) }

    it "switches a person's off for an administrator, signs them out everywhere, and says so in the audit log" do
      old_jti = user.jti
      post "/api/v1/users/#{user.id}/reset_two_factor", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json_body["user"]["two_factor_enabled"]).to be(false)
      expect(user.reload).not_to be_two_factor_enabled
      expect(user.jti).not_to eq(old_jti)
      expect(ActivityLog.where(action: "user.two_factor_reset", resource_id: user.id, user_id: admin.id).count).to eq(1)
    end

    it "is for administrators" do
      manager = create(:user, :manager, organization: org)
      post "/api/v1/users/#{user.id}/reset_two_factor", headers: auth_headers_for(manager)

      expect(response).to have_http_status(:forbidden)
      expect(user.reload).to be_two_factor_enabled
    end

    it "is refused for oneself, for a person who has it off, and for another company's person" do
      enable_two_factor_for(admin)
      post "/api/v1/users/#{admin.id}/reset_two_factor", headers: { "Authorization" => sign_in_token(admin) }
      expect(response).to have_http_status(:unprocessable_entity)

      plain = create(:user, organization: org)
      post "/api/v1/users/#{plain.id}/reset_two_factor", headers: { "Authorization" => sign_in_token(admin) }
      expect(response).to have_http_status(:unprocessable_entity)

      stranger = create(:user)
      enable_two_factor_for(stranger)
      post "/api/v1/users/#{stranger.id}/reset_two_factor", headers: { "Authorization" => sign_in_token(admin) }
      expect(response).to have_http_status(:not_found)
      expect(stranger.reload).to be_two_factor_enabled
    end

    def sign_in_token(person)
      post "/api/v1/auth/sign_in", params: { user: { email: person.email, password: "password123" } }, as: :json
      post "/api/v1/auth/two_factor", params: { challenge: json_body["challenge"], code: code_for(person) }, as: :json
      person.reload.update!(otp_last_step: nil)
      response.headers["Authorization"]
    end
  end
end
