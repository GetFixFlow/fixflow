require "rails_helper"

RSpec.describe "IoT Ingestion & Data API", type: :request do
  let(:org)    { create(:organization) }
  let(:user)   { create(:user, :manager, organization: org) }
  let(:asset)  { create(:asset, organization: org) }
  let(:headers) { auth_headers_for(user) }

  let(:raw_key)  { "fxk_validkey123abc" }
  let!(:api_key) { create(:api_key, organization: org, key_digest: BCrypt::Password.create(raw_key)) }

  # ── POST /api/v1/iot/ingest ──────────────────────────────────────────────

  describe "POST /api/v1/iot/ingest" do
    let(:payload) do
      { asset_id: asset.id.to_s, metric: "temperature", value: 72.4, unit: "celsius",
        device_id: "sensor-001", timestamp: Time.current.iso8601 }
    end

    context "with valid API key" do
      it "returns 200" do
        post "/api/v1/iot/ingest",
          params: payload.to_json,
          headers: { "Content-Type" => "application/json", "X-API-Key" => raw_key }
        expect(response).to have_http_status(:ok)
      end

      it "creates a SensorReading" do
        expect {
          post "/api/v1/iot/ingest",
            params: payload.to_json,
            headers: { "Content-Type" => "application/json", "X-API-Key" => raw_key }
        }.to change(SensorReading, :count).by(1)
      end

      it "accepts batch array payload" do
        batch = [
          { asset_id: asset.id.to_s, metric: "temperature", value: 72.4 },
          { asset_id: asset.id.to_s, metric: "vibration",   value: 3.2 }
        ]
        expect {
          post "/api/v1/iot/ingest",
            params: batch.to_json,
            headers: { "Content-Type" => "application/json", "X-API-Key" => raw_key }
        }.to change(SensorReading, :count).by(2)
      end
    end

    context "with invalid API key" do
      it "returns 401" do
        post "/api/v1/iot/ingest",
          params: payload.to_json,
          headers: { "Content-Type" => "application/json", "X-API-Key" => "invalid-key" }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with no API key" do
      it "returns 401" do
        post "/api/v1/iot/ingest",
          params: payload.to_json,
          headers: { "Content-Type" => "application/json" }
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  # ── GET /api/v1/iot/assets/:id/latest ────────────────────────────────────

  describe "GET /api/v1/iot/assets/:id/latest" do
    before do
      create(:sensor_reading, asset: asset, organization: org, metric_name: "temperature", value: 72.4, unit: "celsius")
      create(:sensor_reading, asset: asset, organization: org, metric_name: "vibration",   value: 3.2,  unit: "mm/s")
    end

    it "returns latest reading per metric" do
      get "/api/v1/iot/assets/#{asset.id}/latest", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body["readings"]).to have_key("temperature")
      expect(body["readings"]).to have_key("vibration")
      expect(body["readings"]["temperature"]["value"].to_f).to eq(72.4)
    end
  end

  # ── GET /api/v1/iot/assets/:id/readings ──────────────────────────────────

  describe "GET /api/v1/iot/assets/:id/readings" do
    before do
      create(:sensor_reading, asset: asset, organization: org, metric_name: "temperature",
             value: 70.0, recorded_at: 2.hours.ago)
      create(:sensor_reading, asset: asset, organization: org, metric_name: "temperature",
             value: 75.0, recorded_at: 1.hour.ago)
    end

    it "returns sensor readings" do
      get "/api/v1/iot/assets/#{asset.id}/readings", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["readings"].size).to eq(2)
    end

    it "filters by metric" do
      create(:sensor_reading, :vibration, asset: asset, organization: org)
      get "/api/v1/iot/assets/#{asset.id}/readings?metric=temperature", headers: headers
      body = JSON.parse(response.body)
      expect(body["readings"].map { |r| r["metric_name"] }.uniq).to eq(["temperature"])
    end

    it "supports date range filtering" do
      from = 90.minutes.ago.iso8601
      to   = 30.minutes.ago.iso8601
      get "/api/v1/iot/assets/#{asset.id}/readings?from=#{from}&to=#{to}", headers: headers
      body = JSON.parse(response.body)
      expect(body["readings"].size).to eq(1)
    end
  end

  # ── PATCH /api/v1/iot_alerts/:id/acknowledge ─────────────────────────────

  describe "PATCH /api/v1/iot_alerts/:id/acknowledge" do
    let(:rule)    { create(:iot_rule, asset: asset, organization: org) }
    let(:reading) { create(:sensor_reading, asset: asset, organization: org) }
    let(:alert)   { create(:iot_alert, iot_rule: rule, asset: asset, sensor_reading: reading) }

    it "marks alert as acknowledged" do
      patch "/api/v1/iot_alerts/#{alert.id}/acknowledge",
        params: { notes: "Checked and noted" }.to_json,
        headers: headers.merge("Content-Type" => "application/json")

      expect(response).to have_http_status(:ok)
      expect(alert.reload.status).to eq("acknowledged")
      expect(alert.reload.acknowledged_by).to eq(user)
    end
  end
end
