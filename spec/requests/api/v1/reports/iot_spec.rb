require "rails_helper"

RSpec.describe "IoT Reports", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:asset)   { create(:asset, organization: org) }
  let(:headers) { auth_headers_for(manager) }

  describe "GET /api/v1/reports/iot/alert_summary" do
    before do
      rule  = create(:iot_rule, asset: asset, organization: org)
      create(:iot_alert, iot_rule: rule, asset: asset, status: :open)
      create(:iot_alert, iot_rule: rule, asset: asset, status: :resolved)
    end

    it "returns alert summary" do
      get "/api/v1/reports/iot/alert_summary",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601 },
        headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("total_alerts", "open", "acknowledged", "resolved",
                              "auto_work_orders_created", "by_asset", "by_metric", "trend")
    end

    it "can filter by asset_id" do
      get "/api/v1/reports/iot/alert_summary",
        params: { from: 30.days.ago.iso8601, to: Time.current.iso8601, asset_id: asset.id },
        headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["total_alerts"]).to eq(2)
    end
  end

  describe "GET /api/v1/reports/iot/sensor_trends" do
    before do
      create(:sensor_reading, asset: asset, metric_name: "temperature", value: 72.5,
             recorded_at: 2.hours.ago)
      create(:sensor_aggregate, asset: asset, metric_name: "temperature",
             period_type: :hourly, period_start: 2.hours.ago.beginning_of_hour,
             min_value: 70.0, max_value: 75.0, avg_value: 72.5, reading_count: 10)
    end

    it "returns sensor trend data" do
      get "/api/v1/reports/iot/sensor_trends",
        params: { asset_id: asset.id, from: 1.day.ago.iso8601, to: Time.current.iso8601 },
        headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to include("asset", "period", "metrics")
      expect(body["metrics"]).to have_key("temperature")
    end

    it "requires asset_id" do
      get "/api/v1/reports/iot/sensor_trends",
        params: { from: 1.day.ago.iso8601, to: Time.current.iso8601 },
        headers: headers, as: :json

      expect(response).to have_http_status(:bad_request)
    end
  end
end
