require "rails_helper"

RSpec.describe "An asset's sensor readings", type: :request do
  let(:org)   { create(:organization) }
  let(:user)  { create(:user, organization: org) }
  let(:asset) { create(:asset, organization: org) }

  it "names each reading's metric as the screens do (sensor_type) as well as by its own name" do
    create(:sensor_reading, asset: asset, organization: org, metric_name: "vibration", value: 3.2, unit: "mm/s",
recorded_at: 5.minutes.ago)

    get "/api/v1/assets/#{asset.id}/sensor_readings", headers: auth_headers_for(user)

    expect(response).to have_http_status(:ok)
    expect(json_body["sensor_readings"].first).to include("metric_name" => "vibration", "sensor_type" => "vibration", "unit" => "mm/s")
    expect(json_body["sensor_readings"].first["value"].to_f).to eq(3.2)
  end

  it "shows the last 24 hours, newest first, and nothing from another company's asset" do
    old = create(:sensor_reading, asset: asset, organization: org, recorded_at: 2.days.ago)
    newer = create(:sensor_reading, asset: asset, organization: org, recorded_at: 1.hour.ago)
    newest = create(:sensor_reading, asset: asset, organization: org, recorded_at: 1.minute.ago)

    get "/api/v1/assets/#{asset.id}/sensor_readings", headers: auth_headers_for(user)
    expect(json_body["sensor_readings"].pluck("id")).to eq([newest.id, newer.id])
    expect(json_body["sensor_readings"].pluck("id")).not_to include(old.id)

    foreign = create(:asset, organization: create(:organization))
    get "/api/v1/assets/#{foreign.id}/sensor_readings", headers: auth_headers_for(user)
    expect(response).to have_http_status(:not_found)
  end
end
