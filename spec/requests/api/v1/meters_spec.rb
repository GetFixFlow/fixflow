require "rails_helper"

RSpec.describe "Api::V1::Meters", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let(:asset)      { create(:asset, organization: org) }
  let!(:meter)     { create(:meter, organization: org, asset: asset, name: "Running hours", reading: 4120.5) }

  describe "GET /api/v1/assets/:id/meters" do
    it "lists the asset's meters with the reading as a number, for a technician" do
      get "/api/v1/assets/#{asset.id}/meters", headers: auth_headers_for(technician)

      expect(response).to have_http_status(:ok)
      expect(json_body["meters"]).to contain_exactly(include("name" => "Running hours", "unit" => "hours", "reading" => 4120.5))
    end

    it "is not for a requester, and not across companies" do
      get "/api/v1/assets/#{asset.id}/meters", headers: auth_headers_for(requester)
      expect(response).to have_http_status(:forbidden)

      get "/api/v1/assets/#{asset.id}/meters", headers: auth_headers_for(create(:user, :manager))
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/assets/:id/meters" do
    let(:params) { { meter: { name: "Odometer", unit: "km", reading: 88_000, sensor_metric: "odometer" } } }

    it "lets a manager add a meter that starts where the machine stands, with that as its first reading" do
      post "/api/v1/assets/#{asset.id}/meters", params: params, headers: auth_headers_for(manager)

      expect(response).to have_http_status(:created)
      made = Meter.find(json_body["data"]["id"])
      expect(made).to have_attributes(name: "Odometer", unit: "km", reading: 88_000, sensor_metric: "odometer", organization_id: org.id)
      expect(made.readings.pluck(:value, :note)).to eq([[88_000, "Starting reading"]])
    end

    it "refuses a technician, and a name already used on the asset" do
      post "/api/v1/assets/#{asset.id}/meters", params: params, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)

      post "/api/v1/assets/#{asset.id}/meters", params: { meter: { name: "running hours", unit: "h" } },
        headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "refuses a reading that is not a number" do
      post "/api/v1/assets/#{asset.id}/meters", params: { meter: { name: "X", unit: "h", reading: "lots" } },
        headers: auth_headers_for(manager)

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH and DELETE /api/v1/meters/:id" do
    it "renames a meter but never moves its reading" do
      patch "/api/v1/meters/#{meter.id}", params: { meter: { name: "Hours run", reading: 1 } }, headers: auth_headers_for(manager)

      expect(response).to have_http_status(:ok)
      expect(meter.reload).to have_attributes(name: "Hours run", reading: 4120.5)
    end

    it "deletes a meter, but not one a maintenance schedule follows" do
      create(:preventive_maintenance, :meter_based_pm, organization: org, asset: asset, meter: meter)

      delete "/api/v1/meters/#{meter.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["code"]).to eq("METER_IN_USE")

      PreventiveMaintenance.destroy_all
      delete "/api/v1/meters/#{meter.id}", headers: auth_headers_for(manager)
      expect(response).to have_http_status(:no_content)
    end

    it "is a manager's to change" do
      patch "/api/v1/meters/#{meter.id}", params: { meter: { name: "Mine" } }, headers: auth_headers_for(technician)
      delete "/api/v1/meters/#{meter.id}", headers: auth_headers_for(technician)

      expect(meter.reload.name).to eq("Running hours")
    end
  end

  describe "readings" do
    it "lets a technician record one, and answers with the meter as it now stands" do
      post "/api/v1/meters/#{meter.id}/readings", params: { reading: { value: 4130, note: "Shift end" } },
        headers: auth_headers_for(technician)

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("value" => 4130.0, "recorded_by" => technician.full_name, "note" => "Shift end",
        "reset" => false)
      expect(json_body["meter"]).to include("reading" => 4130.0)
    end

    it "refuses a lower reading with the reason, and a reset by a technician" do
      post "/api/v1/meters/#{meter.id}/readings", params: { reading: { value: 4000 } }, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["code"]).to eq("METER_READING_REFUSED")
      expect(json_body["error"]["message"]).to include("lower than the last reading")

      post "/api/v1/meters/#{meter.id}/readings", params: { reading: { value: 0, reset: true } }, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
      expect(meter.reload.reading).to eq(4120.5)
    end

    it "lets a manager reset a meter that was replaced" do
      post "/api/v1/meters/#{meter.id}/readings", params: { reading: { value: 3, reset: true, note: "New unit" } },
        headers: auth_headers_for(manager)

      expect(response).to have_http_status(:created)
      expect(meter.reload.reading).to eq(3)
    end

    it "lists the history, newest first, and is not for a requester or another company" do
      create(:meter_reading, meter: meter, value: 10, recorded_at: 2.days.ago)
      create(:meter_reading, meter: meter, value: 20, recorded_at: 1.day.ago)

      get "/api/v1/meters/#{meter.id}/readings", headers: auth_headers_for(technician)
      expect(json_body["readings"].pluck("value")).to eq([20.0, 10.0])

      get "/api/v1/meters/#{meter.id}/readings", headers: auth_headers_for(requester)
      expect(response).to have_http_status(:forbidden)

      get "/api/v1/meters/#{meter.id}/readings", headers: auth_headers_for(create(:user, :manager))
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "a meter-based maintenance schedule" do
    it "is made with a meter, shows how far off it is, and is due once the meter gets there" do
      post "/api/v1/preventive_maintenances", headers: auth_headers_for(manager), params: { preventive_maintenance: {
        name: "Oil change", asset_id: asset.id, frequency_type: "meter_based", frequency_value: 250, meter_id: meter.id,
        start_date: Date.current, template: { title: "Oil change on {asset_name}" }
      } }

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("next_due_reading" => 4370.5, "frequency_unit" => "hours",
                                           "meter" => include("id" => meter.id, "reading" => 4120.5))
      post "/api/v1/meters/#{meter.id}/readings", params: { reading: { value: 4400 } }, headers: auth_headers_for(technician)
      expect(WorkOrder.where(asset: asset).pluck(:title)).to eq(["Oil change on #{asset.name}"])
    end

    it "is refused without a meter" do
      post "/api/v1/preventive_maintenances", headers: auth_headers_for(manager), params: { preventive_maintenance: {
        name: "Oil change", asset_id: asset.id, frequency_type: "meter_based", frequency_value: 250, start_date: Date.current,
        template: { title: "x" }
      } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["message"]).to include("Meter")
    end
  end
end
