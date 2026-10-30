require "rails_helper"

RSpec.describe "Notification preferences", type: :request do
  let(:organization) { create(:organization) }
  let(:user)  { create(:user, organization: organization) }
  let(:other) { create(:user, organization: organization) }

  def change(preferences, as: user)
    patch "/api/v1/notification_preferences", params: { preferences: preferences }, as: :json, headers: auth_headers_for(as)
  end

  describe "GET /api/v1/notification_preferences" do
    it "shows everything on for someone who has never changed anything" do
      get "/api/v1/notification_preferences", headers: auth_headers_for(user)

      expect(response).to have_http_status(:ok)
      prefs = json_body["preferences"]
      expect(prefs["email_enabled"]).to be(true)
      expect(prefs["rules"].keys).to match_array(EmailPreferences::EMAIL_EVENTS)
      expect(prefs["push_enabled"]).to be(true)
      expect(prefs["rules"].slice(*EmailPreferences::PUSH_EVENTS).values).to all(eq("email" => true, "push" => true))
      # Only the time-sensitive ones can be pushed; the daily summaries are email only.
      expect(prefs["rules"].except(*EmailPreferences::PUSH_EVENTS).values).to all(eq("email" => true))
    end

    it "needs a sign-in" do
      get "/api/v1/notification_preferences"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/v1/notification_preferences" do
    it "saves what was changed and keeps it" do
      change({ rules: { wo_assigned: { email: false } } })

      expect(response).to have_http_status(:ok)
      expect(json_body.dig("preferences", "rules", "wo_assigned")).to eq("email" => false, "push" => true)
      get "/api/v1/notification_preferences", headers: auth_headers_for(user)
      expect(json_body.dig("preferences", "rules", "wo_assigned")).to eq("email" => false, "push" => true)
      expect(json_body.dig("preferences", "rules", "pm_overdue")).to eq("email" => true)
    end

    it "saves push choices apart from email ones: the master switch, and one for each event that can be pushed" do
      change({ push_enabled: false, rules: { wo_assigned: { push: false }, wo_verified: { email: false, push: true } } })

      prefs = json_body["preferences"]
      expect(prefs["push_enabled"]).to be(false)
      expect(prefs["email_enabled"]).to be(true)
      expect(prefs["rules"]["wo_assigned"]).to eq("email" => true, "push" => false)
      expect(prefs["rules"]["wo_verified"]).to eq("email" => false, "push" => true)
    end

    it "ignores a push choice for an event that cannot be pushed, and still refuses what is not on or off" do
      change({ rules: { pm_overdue: { push: false } } })

      expect(response).to have_http_status(:ok)
      expect(json_body.dig("preferences", "rules", "pm_overdue")).to eq("email" => true)

      change({ push_enabled: "maybe" })
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "saves the master switch" do
      change({ email_enabled: false })

      expect(json_body.dig("preferences", "email_enabled")).to be(false)
      expect(user.reload.wants_email?("wo_assigned")).to be(false)
    end

    it "only ever changes the signed-in person's own choices" do
      change({ email_enabled: false, user_id: other.id })

      expect(other.reload.wants_email?("wo_assigned")).to be(true)
      expect(user.reload.wants_email?("wo_assigned")).to be(false)
    end

    it "refuses a value that is not on or off, and changes nothing" do
      change({ rules: { wo_assigned: { email: "maybe" } } })

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("VALIDATION_ERROR")
      expect(user.reload.notification_preferences).to eq({})
    end

    it "asks for the preferences when none are sent" do
      patch "/api/v1/notification_preferences", params: {}, as: :json, headers: auth_headers_for(user)

      expect(response).to have_http_status(:bad_request)
    end

    it "needs a sign-in" do
      patch "/api/v1/notification_preferences", params: { preferences: { email_enabled: false } }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "does not touch what other settings own (roles, deactivation) through a crafted body" do
      change({ email_enabled: false, role: "admin", deactivated_at: nil, notification_preferences: { x: 1 } })

      expect(user.reload.role).not_to eq("admin")
      expect(user.notification_preferences.keys).to match_array(%w[email_enabled push_enabled rules])
    end
  end
end
