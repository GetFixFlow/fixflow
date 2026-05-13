require "rails_helper"

RSpec.describe "PM Reports", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:asset)   { create(:asset, organization: org) }
  let(:headers) { auth_headers_for(manager) }

  describe "GET /api/v1/reports/pm/compliance" do
    before do
      pm = create(:preventive_maintenance, organization: org, asset: asset)
      create(:pm_execution, preventive_maintenance: pm, status: :completed,
             scheduled_date: 15.days.ago.to_date)
      create(:pm_execution, preventive_maintenance: pm, status: :skipped,
             scheduled_date: 10.days.ago.to_date)
    end

    it "returns compliance report" do
      get "/api/v1/reports/pm/compliance",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("overall_compliance_rate", "period", "summary",
                              "by_month", "by_location", "worst_performing_assets")
    end

    it "returns CSV" do
      get "/api/v1/reports/pm/compliance.csv",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include("text/csv")
    end
  end

  describe "GET /api/v1/reports/pm/schedule_forecast" do
    before do
      create(:preventive_maintenance, :active_pm,
             organization: org, asset: asset, next_due_at: 5.days.from_now)
    end

    it "returns upcoming PM schedule grouped by week" do
      get "/api/v1/reports/pm/schedule_forecast",
        params: { days: 30 },
        headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("forecast_days", "total_upcoming", "estimated_hours", "by_week")
    end

    it "caps days at 90" do
      get "/api/v1/reports/pm/schedule_forecast",
        params: { days: 200 },
        headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["forecast_days"]).to eq(90)
    end
  end
end
