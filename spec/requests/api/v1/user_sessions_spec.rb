require "rails_helper"

RSpec.describe "Sessions", type: :request do
  let(:organization) { create(:organization) }
  let(:user)  { create(:user, organization: organization) }
  let(:other) { create(:user, organization: organization) }

  let(:chrome_mac) { "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36" }
  let(:safari_ios) { "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1" }

  # Signs in the way a browser does, and returns the headers to use afterwards.
  def sign_in_as(person, agent: chrome_mac, ip: "203.0.113.7")
    post "/api/v1/auth/sign_in", params: { user: { email: person.email, password: "password123" } }, as: :json,
                                 headers: { "User-Agent" => agent, "REMOTE_ADDR" => ip }
    expect(response).to have_http_status(:ok)
    { "Authorization" => response.headers["Authorization"] }
  end

  def list(headers)
    get "/api/v1/sessions", headers: headers
    json_body["sessions"]
  end

  def works?(headers)
    get "/api/v1/auth/me", headers: headers
    response.status == 200
  end

  describe "signing in" do
    it "starts exactly one session, noting the browser and address" do
      expect { sign_in_as(user) }.to change { user.user_sessions.count }.by(1)

      session = user.user_sessions.last
      expect(session).to have_attributes(user_agent: chrome_mac, ip_address: "203.0.113.7", revoked_at: nil, jti: user.jti)
      expect(session.expires_at).to be_within(1.minute).of(24.hours.from_now)
    end

    it "starts one session for each sign-in, so two browsers are two sessions" do
      sign_in_as(user)
      sign_in_as(user, agent: safari_ios, ip: "198.51.100.2")

      expect(user.user_sessions.count).to eq(2)
    end

    it "starts none for a wrong password" do
      post "/api/v1/auth/sign_in", params: { user: { email: user.email, password: "wrong" } }, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(user.user_sessions.count).to eq(0)
    end

    it "starts one for the first-run setup too, so the admin is not signed out on the next request" do
      ActsAsTenant.without_tenant { Organization.destroy_all }

      post "/api/v1/auth/sign_up", as: :json, params: {
        user: { email: "admin@acme.com", password: "securepass1", password_confirmation: "securepass1",
                first_name: "Jane", last_name: "Smith", organization_name: "Acme" }
      }
      expect(response).to have_http_status(:created)
      headers = { "Authorization" => response.headers["Authorization"] }

      expect(works?(headers)).to be(true)
      expect(User.find_by!(email: "admin@acme.com").user_sessions.count).to eq(1)
    end

    it "still signs in when the browser sends text the database would refuse" do
      weird = "Mozilla/5.0 (X11; Linux) Chrome/126\u0000 caf\xE9 \xFF\xFE".b

      sign_in_as(user, agent: weird)

      expect(user.user_sessions.last.user_agent).to eq("Mozilla/5.0 (X11; Linux) Chrome/126 caf")
    end

    it "does not keep a long user agent whole" do
      sign_in_as(user, agent: "a" * 5000)

      expect(user.user_sessions.last.user_agent.length).to eq(255)
    end
  end

  describe "GET /api/v1/sessions" do
    it "needs a sign-in" do
      get "/api/v1/sessions"

      expect(response).to have_http_status(:unauthorized)
    end

    it "lists where the person is signed in, this one first and marked" do
      laptop = sign_in_as(user)
      sign_in_as(user, agent: safari_ios, ip: "198.51.100.2")

      sessions = list(laptop)

      expect(sessions.size).to eq(2)
      expect(sessions.first).to include("device" => "Chrome on macOS", "ip_address" => "203.0.113.7", "current" => true)
      expect(sessions.last).to include("device" => "Safari on iOS", "ip_address" => "198.51.100.2", "current" => false)
      expect(sessions.first.keys).to match_array(%w[id device ip_address created_at last_active_at current])
    end

    it "marks the session the request came from, whichever it is" do
      sign_in_as(user)
      phone = sign_in_as(user, agent: safari_ios)

      expect(list(phone).find { |s| s["current"] }["device"]).to eq("Safari on iOS")
    end

    it "does not show anyone else's sessions, nor their ids" do
      mine = sign_in_as(user)
      sign_in_as(other, agent: safari_ios)

      sessions = list(mine)

      expect(sessions.size).to eq(1)
      expect(response.body).not_to include(other.user_sessions.first.sid)
    end

    it "does not show ended or expired sessions" do
      laptop = sign_in_as(user)
      sign_in_as(user, agent: safari_ios)
      user.user_sessions.find_by(user_agent: safari_ios).revoke!
      user.user_sessions.create!(sid: "old", jti: user.jti, expires_at: 1.hour.ago, last_active_at: 2.days.ago)

      expect(list(laptop).size).to eq(1)
    end

    it "does not show the sid as an id that is guessable: ids are random, not counted" do
      laptop = sign_in_as(user)

      expect(list(laptop).first["id"]).to match(/\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/)
    end
  end

  describe "DELETE /api/v1/sessions/:id" do
    it "ends that session: its token stops working, the one asking keeps working" do
      laptop = sign_in_as(user)
      phone  = sign_in_as(user, agent: safari_ios)
      phone_id = list(laptop).find { |s| !s["current"] }["id"]

      delete "/api/v1/sessions/#{phone_id}", headers: laptop

      expect(response).to have_http_status(:no_content)
      expect(works?(phone)).to be(false)
      expect(works?(laptop)).to be(true)
      expect(list(laptop).size).to eq(1)
    end

    it "writes it to the activity log" do
      laptop = sign_in_as(user)
      sign_in_as(user, agent: safari_ios)
      phone_id = list(laptop).find { |s| !s["current"] }["id"]

      expect { delete "/api/v1/sessions/#{phone_id}", headers: laptop }
        .to change { ActsAsTenant.without_tenant { ActivityLog.where(action: "session.revoked", resource_id: user.id).count } }.by(1)
    end

    it "cannot end someone else's session, and cannot tell whether it exists" do
      mine = sign_in_as(user)
      theirs = sign_in_as(other, agent: safari_ios)
      their_id = other.user_sessions.first.sid

      delete "/api/v1/sessions/#{their_id}", headers: mine
      expect(response).to have_http_status(:not_found)
      delete "/api/v1/sessions/#{SecureRandom.uuid}", headers: mine
      expect(response).to have_http_status(:not_found)
      expect(works?(theirs)).to be(true)
    end

    it "does not end the same session twice" do
      laptop = sign_in_as(user)
      sign_in_as(user, agent: safari_ios)
      phone_id = list(laptop).find { |s| !s["current"] }["id"]
      delete "/api/v1/sessions/#{phone_id}", headers: laptop

      delete "/api/v1/sessions/#{phone_id}", headers: laptop

      expect(response).to have_http_status(:not_found)
    end

    it "needs a sign-in" do
      delete "/api/v1/sessions/#{SecureRandom.uuid}"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/v1/sessions/all" do
    it "ends every other session and keeps this one" do
      laptop = sign_in_as(user)
      phone  = sign_in_as(user, agent: safari_ios)
      tablet = sign_in_as(user, agent: safari_ios, ip: "198.51.100.9")

      delete "/api/v1/sessions/all", headers: laptop

      expect(response).to have_http_status(:ok)
      expect(json_body["revoked"]).to eq(2)
      expect(works?(laptop)).to be(true)
      expect(works?(phone)).to be(false)
      expect(works?(tablet)).to be(false)
      expect(list(laptop).size).to eq(1)
    end

    it "leaves other people's sessions alone" do
      mine = sign_in_as(user)
      theirs = sign_in_as(other)

      delete "/api/v1/sessions/all", headers: mine

      expect(json_body["revoked"]).to eq(0)
      expect(works?(theirs)).to be(true)
    end

    it "is not mistaken for a session called 'all'" do
      mine = sign_in_as(user)

      delete "/api/v1/sessions/all", headers: mine

      expect(response).to have_http_status(:ok)
    end

    it "needs a sign-in" do
      delete "/api/v1/sessions/all"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "what ends a session" do
    it "signing out ends that session only: the person stays signed in elsewhere" do
      laptop = sign_in_as(user)
      phone  = sign_in_as(user, agent: safari_ios)

      delete "/api/v1/auth/sign_out", headers: laptop

      expect(response).to have_http_status(:ok)
      expect(works?(laptop)).to be(false)
      expect(works?(phone)).to be(true)
    end

    it "changing the password ends every session, this one included" do
      laptop = sign_in_as(user)
      phone  = sign_in_as(user, agent: safari_ios)

      patch "/api/v1/profile/password", headers: laptop, as: :json,
            params: { user: { current_password: "password123", password: "newpassword456", password_confirmation: "newpassword456" } }
      expect(response).to have_http_status(:ok)

      expect(works?(laptop)).to be(false)
      expect(works?(phone)).to be(false)
    end

    it "deactivating the person ends every session" do
      laptop = sign_in_as(user)
      admin = create(:user, :admin, organization: organization)

      UserAdministration.deactivate!(user, by: admin)

      expect(works?(laptop)).to be(false)
    end

    it "a token made without signing in (no session) is not accepted" do
      token = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil).first

      get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{token}" }

      expect(response).to have_http_status(:unauthorized)
    end

    it "a token from before sessions existed (no session id) is not accepted" do
      token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
      payload = Warden::JWTAuth::TokenDecoder.new.call(token).except("sid")
      old = Warden::JWTAuth::TokenEncoder.new.call(payload)

      get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{old}" }

      expect(response).to have_http_status(:unauthorized)
    end

    it "a session past its expiry is not live even if the token were still accepted" do
      laptop = sign_in_as(user)
      user.user_sessions.update_all(expires_at: 1.minute.ago) # rubocop:disable Rails/SkipsModelValidations

      expect(works?(laptop)).to be(false)
    end
  end

  describe "last active" do
    it "is brought up to date at most every 5 minutes" do
      laptop = sign_in_as(user)
      session = user.user_sessions.first
      session.update_columns(last_active_at: 10.minutes.ago) # rubocop:disable Rails/SkipsModelValidations

      works?(laptop)
      first = session.reload.last_active_at
      expect(first).to be > 1.minute.ago

      travel 2.minutes
      works?(laptop)
      expect(session.reload.last_active_at).to eq(first)

      travel 5.minutes
      works?(laptop)
      expect(session.reload.last_active_at).to be > first
    end
  end
end
