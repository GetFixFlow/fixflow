require "rails_helper"

RSpec.describe "Api::V1::LocalizationSettings", type: :request do
  let(:org)        { create(:organization) }
  let(:admin)      { create(:user, :admin, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:changes)    do
    { timezone: "Asia/Colombo", date_format: "DD/MM/YYYY", time_format: "24h", currency: "LKR",
      number_format: "1 234,56", first_day_of_week: "monday" }
  end

  def patch_settings(as: admin, **params)
    patch "/api/v1/localization_settings", params: { localization: params }, headers: auth_headers_for(as), as: :json
  end

  describe "GET /api/v1/localization_settings" do
    it "has sensible defaults, and every screen can read them" do
      get "/api/v1/localization_settings", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:ok)
      expect(json_body["localization"]).to eq(
        "timezone" => "UTC", "date_format" => "MMM D, YYYY", "time_format" => "12h",
        "currency" => "USD", "number_format" => "1,234.56", "first_day_of_week" => "sunday"
      )
    end

    it "requires signing in" do
      get "/api/v1/localization_settings"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "PATCH /api/v1/localization_settings" do
    it "saves the settings, and they survive a reload, for everyone" do
      patch_settings(**changes)

      expect(response).to have_http_status(:ok)
      get "/api/v1/localization_settings", headers: auth_headers_for(technician)
      expect(json_body["localization"]).to eq(changes.stringify_keys)
    end

    it "shares the time zone with the company settings" do
      patch_settings(timezone: "Asia/Colombo")

      get "/api/v1/organization_settings", headers: auth_headers_for(admin)
      expect(json_body.dig("organization", "timezone")).to eq("Asia/Colombo")
    end

    it "changes only what it is given" do
      patch_settings(**changes)
      patch_settings(currency: "EUR")

      expect(json_body["localization"]).to include("currency" => "EUR", "date_format" => "DD/MM/YYYY", "timezone" => "Asia/Colombo")
    end

    it "does not touch the rest of the company settings" do
      org.assign_company_settings("wo_number_prefix" => "MNT")
      org.save!

      patch_settings(**changes)

      expect(org.reload.prefix_for_work_orders).to eq("MNT")
    end

    {
      date_format: "YYYY/DD/MM", time_format: "36h", currency: "XXX", number_format: "1'234.56",
      first_day_of_week: "friday", timezone: "Mars/Olympus"
    }.each do |key, bad|
      it "refuses #{bad.inspect} for #{key}, saving nothing" do
        patch_settings(**changes, key => bad)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(org.reload.settings_with_defaults["currency"]).to eq("USD")
      end
    end

    it "is for administrators only" do
      patch_settings(as: technician, **changes)

      expect(response).to have_http_status(:forbidden)
      expect(org.reload.settings_with_defaults["currency"]).to eq("USD")
    end

    it "keeps a record of who changed it" do
      patch_settings(**changes)

      expect(ActivityLog.where(action: "localization_settings.updated").last.user_id).to eq(admin.id)
    end
  end
end
