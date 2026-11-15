require "rails_helper"

RSpec.describe "Sensor anomalies", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:asset)      { create(:asset, organization: org, name: "Pump 3", location: create(:location, organization: org, name: "Hall")) }

  def flag(**attributes) = create(:sensor_anomaly, organization: org, asset: asset, **attributes)

  def patch_to(path, body = {}, as: manager)
    patch path, params: body.to_json, headers: auth_headers_for(as).merge("Content-Type" => "application/json")
  end

  describe "GET /api/v1/sensor_anomalies" do
    it "needs a sign-in, and a technician or above" do
      get "/api/v1/sensor_anomalies"
      expect(response).to have_http_status(:unauthorized)

      get "/api/v1/sensor_anomalies", headers: auth_headers_for(create(:user, :requester, organization: org))
      expect(response).to have_http_status(:forbidden)
    end

    it "lists the company's flags, newest first, with what the screen shows" do
      older = flag(created_at: 2.days.ago)
      newer = flag(value: 91.2)

      get "/api/v1/sensor_anomalies", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:ok)
      expect(json_body["sensor_anomalies"].pluck("id")).to eq([newer.id, older.id])
      expect(json_body["sensor_anomalies"].first).to include(
        "status" => "open", "metric_name" => "temperature", "unit" => "°C", "value" => 91.2, "usual_low" => 62.0, "usual_high" => 74.0,
        "message" => "temperature reads 91.2 °C; it is usually 62 to 74 °C", "location_path" => "Hall",
        "asset" => { "id" => asset.id, "name" => "Pump 3", "asset_tag" => asset.asset_tag }
      )
      expect(json_body["meta"]["pagination"]).to be_present
    end

    it "does not show another company's flags" do
      create(:sensor_anomaly)

      get "/api/v1/sensor_anomalies", headers: auth_headers_for(technician)

      expect(json_body["sensor_anomalies"]).to eq([])
    end

    it "can be narrowed to a status or an asset" do
      open_one = flag
      flag(status: :dismissed)
      elsewhere = flag(asset: create(:asset, organization: org))

      get "/api/v1/sensor_anomalies", params: { status: "open", asset_id: asset.id }, headers: auth_headers_for(technician)

      expect(json_body["sensor_anomalies"].pluck("id")).to eq([open_one.id])
      expect(json_body["sensor_anomalies"].pluck("id")).not_to include(elsewhere.id)
    end
  end

  describe "acknowledging and dismissing" do
    it "is for managers" do
      one = flag

      patch_to("/api/v1/sensor_anomalies/#{one.id}/acknowledge", as: technician)
      expect(response).to have_http_status(:forbidden)
      patch_to("/api/v1/sensor_anomalies/#{one.id}/dismiss", as: technician)
      expect(response).to have_http_status(:forbidden)
      expect(one.reload).to be_open
    end

    it "records who looked at it and what they said" do
      one = flag

      patch_to("/api/v1/sensor_anomalies/#{one.id}/acknowledge", { notes: "Checking the bearing" })

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]).to include("status" => "acknowledged", "notes" => "Checking the bearing",
                                           "acknowledged_by" => { "id" => manager.id, "full_name" => manager.full_name })
    end

    it "dismisses one as nothing" do
      one = flag

      patch_to("/api/v1/sensor_anomalies/#{one.id}/dismiss", { notes: "Probe was out of the pump" })

      expect(one.reload).to have_attributes(status: "dismissed", notes: "Probe was out of the pump")
    end

    it "says in words when it is already over" do
      one = flag(status: :dismissed)

      patch_to("/api/v1/sensor_anomalies/#{one.id}/acknowledge")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("This flag is dismissed, so it cannot be acknowledged")
    end

    it "cannot reach another company's flag" do
      other = create(:sensor_anomaly)

      patch_to("/api/v1/sensor_anomalies/#{other.id}/dismiss")

      expect(response).to have_http_status(:not_found)
      expect(other.reload).to be_open
    end
  end
end
