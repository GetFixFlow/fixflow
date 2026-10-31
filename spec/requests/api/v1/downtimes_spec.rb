require "rails_helper"

RSpec.describe "Api::V1::Downtimes", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:requester)  { create(:user, :requester, organization: org) }
  let(:asset)      { create(:asset, organization: org) }
  let(:now)        { Time.utc(2026, 10, 16, 12, 0) }
  let(:path)       { "/api/v1/assets/#{asset.id}/downtimes" }

  around { |example| travel_to(now) { example.run } }

  def send_json(verb, url, body = nil, as: technician)
    public_send(verb, url, params: body&.to_json, headers: auth_headers_for(as).merge("Content-Type" => "application/json"))
  end

  describe "GET /assets/:id/downtimes" do
    it "lists them newest first, with how long each lasted and who recorded it" do
      older = create(:asset_downtime, organization: org, asset: asset, started_at: now - 30.hours, ended_at: now - 26.hours)
      newer = create(:asset_downtime, organization: org, asset: asset, started_at: now - 5.hours, ended_at: now - 2.hours,
                                      reason: "Belt snapped", started_by: technician)
      create(:asset_downtime, organization: org)

      send_json :get, path

      expect(response).to have_http_status(:ok)
      expect(json_body["downtimes"].pluck("id")).to eq([newer.id, older.id])
      expect(json_body["downtimes"].first).to include("hours" => 3.0, "open" => false, "reason" => "Belt snapped",
                                                      "started_by" => technician.full_name, "ended_by" => nil)
    end

    it "gives the hours so far for one that is still going on" do
      create(:asset_downtime, :open, organization: org, asset: asset, started_at: now - 90.minutes)

      send_json :get, path

      expect(json_body["downtimes"].first).to include("open" => true, "ended_at" => nil, "hours" => 1.5)
    end

    it "is closed to a requester, and to another company's asset" do
      send_json :get, path, as: requester
      expect(response).to have_http_status(:forbidden)

      send_json :get, "/api/v1/assets/#{create(:asset).id}/downtimes"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /assets/:id/downtimes (it stopped now)" do
    it "marks the asset down from this moment, and says who" do
      send_json :post, path, { downtime: { reason: "Making a noise" } }

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("open" => true, "reason" => "Making a noise", "started_by" => technician.full_name)
      expect(Time.zone.parse(json_body.dig("data", "started_at"))).to eq(now)
      expect(asset.reload.status).to eq("down")
    end

    it "is written to the audit log once, naming the asset, besides the asset's own change of status" do
      send_json :post, path, { downtime: { reason: "Making a noise" } }

      lines = ActivityLog.where(action: %w[asset.updated asset_downtime.created asset_downtime.updated])
      expect(lines.order(:id).pluck(:action,
:resource_name)).to eq([["asset.updated", asset.name], ["asset_downtime.created", asset.name]])
    end

    it "can say it stopped earlier today" do
      send_json :post, path, { downtime: { started_at: (now - 3.hours).iso8601 } }

      expect(Time.zone.parse(json_body.dig("data", "started_at"))).to eq(now - 3.hours)
      expect(json_body.dig("data", "hours")).to eq(3.0)
    end

    it "refuses an asset that is down already, and leaves it as it was" do
      send_json :post, path, { downtime: { reason: "First" } }
      send_json :post, path, { downtime: { reason: "Second" } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("ALREADY_DOWN")
      expect(asset.downtimes.pluck(:reason)).to eq(["First"])
    end

    it "refuses a decommissioned asset" do
      asset.update!(status: "decommissioned")

      send_json :post, path, { downtime: { reason: "x" } }

      expect(json_body.dig("error", "code")).to eq("DECOMMISSIONED")
    end

    it "changes nothing when the start it was given is wrong" do
      send_json :post, path, { downtime: { started_at: (now + 3.hours).iso8601 } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(asset.reload.status).to eq("operational")
      expect(asset.downtimes).to be_empty
    end

    it "is closed to a requester" do
      send_json :post, path, { downtime: { reason: "x" } }, as: requester

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /assets/:id/downtimes (a stop that is over)" do
    it "records it without changing the asset's status" do
      send_json :post, path, { downtime: { started_at: (now - 30.hours).iso8601, ended_at: (now - 26.hours).iso8601, reason: "Fuse" } }

      expect(response).to have_http_status(:created)
      expect(json_body["data"]).to include("open" => false, "hours" => 4.0, "started_by" => technician.full_name,
                                           "ended_by" => technician.full_name)
      expect(asset.reload.status).to eq("operational")
    end

    it "refuses one that overlaps another" do
      create(:asset_downtime, organization: org, asset: asset, started_at: now - 30.hours, ended_at: now - 26.hours)

      send_json :post, path, { downtime: { started_at: (now - 28.hours).iso8601, ended_at: (now - 24.hours).iso8601 } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "message")).to eq("That overlaps another time this asset was down")
    end

    it "refuses one that ends before it starts" do
      send_json :post, path, { downtime: { started_at: (now - 2.hours).iso8601, ended_at: (now - 4.hours).iso8601 } }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /downtimes/:id/restart" do
    let!(:downtime) { create(:asset_downtime, :open, organization: org, asset: asset, started_at: now - 4.hours) }

    it "ends it now and makes the asset operational again" do
      send_json :post, "/api/v1/downtimes/#{downtime.id}/restart"

      expect(response).to have_http_status(:ok)
      expect(json_body["data"]).to include("open" => false, "hours" => 4.0, "ended_by" => technician.full_name)
      expect(asset.reload.status).to eq("operational")
      expect(asset.downtimes.count).to eq(1)
    end

    it "can say it ran again earlier" do
      send_json :post, "/api/v1/downtimes/#{downtime.id}/restart", { ended_at: (now - 1.hour).iso8601 }

      expect(json_body.dig("data", "hours")).to eq(3.0)
    end

    it "refuses an end before the start" do
      send_json :post, "/api/v1/downtimes/#{downtime.id}/restart", { ended_at: (now - 5.hours).iso8601 }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(downtime.reload).to be_open
      expect(asset.reload.status).to eq("down")
    end

    it "says so when it is over already" do
      send_json :post, "/api/v1/downtimes/#{downtime.id}/restart"
      send_json :post, "/api/v1/downtimes/#{downtime.id}/restart"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig("error", "code")).to eq("NOT_DOWN")
    end

    it "does not reach another company's, and is closed to a requester" do
      send_json :post, "/api/v1/downtimes/#{create(:asset_downtime, :open).id}/restart"
      expect(response).to have_http_status(:not_found)

      send_json :post, "/api/v1/downtimes/#{downtime.id}/restart", as: requester
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /downtimes/:id" do
    let!(:downtime) do
      create(:asset_downtime, organization: org, asset: asset, started_at: now - 5.hours, ended_at: now - 2.hours, reason: "Old")
    end

    it "lets a manager correct the times and the note" do
      send_json :patch, "/api/v1/downtimes/#{downtime.id}",
                { downtime: { started_at: (now - 6.hours).iso8601, ended_at: (now - 3.hours).iso8601, reason: "New" } }, as: manager

      expect(response).to have_http_status(:ok)
      expect(downtime.reload).to have_attributes(started_at: now - 6.hours, ended_at: now - 2.hours, reason: "New")
    end

    it "leaves the end alone for a stop that is over, whatever is sent" do
      send_json :patch, "/api/v1/downtimes/#{downtime.id}", { downtime: { reason: "Only the note" } }, as: manager

      expect(downtime.reload).to have_attributes(started_at: now - 5.hours, ended_at: now - 2.hours, reason: "Only the note")
    end

    it "keeps the start when it is sent empty" do
      send_json :patch, "/api/v1/downtimes/#{downtime.id}", { downtime: { started_at: "", reason: "Same start" } }, as: manager

      expect(response).to have_http_status(:ok)
      expect(downtime.reload).to have_attributes(started_at: now - 5.hours, reason: "Same start")
    end

    it "restarts the asset when the end of an open one is given" do
      open = create(:asset_downtime, :open, organization: org, asset: create(:asset, organization: org), started_at: now - 2.hours)

      send_json :patch, "/api/v1/downtimes/#{open.id}", { downtime: { ended_at: (now - 1.hour).iso8601 } }, as: manager

      expect(open.reload.ended_at).to eq(now - 1.hour)
      expect(open.asset.reload.status).to eq("operational")
    end

    it "refuses a change that overlaps another, keeping the record as it was" do
      create(:asset_downtime, organization: org, asset: asset, started_at: now - 9.hours, ended_at: now - 7.hours)

      send_json :patch, "/api/v1/downtimes/#{downtime.id}", { downtime: { started_at: (now - 8.hours).iso8601 } }, as: manager

      expect(response).to have_http_status(:unprocessable_entity)
      expect(downtime.reload.started_at).to eq(now - 5.hours)
    end

    it "is for managers" do
      send_json :patch, "/api/v1/downtimes/#{downtime.id}", { downtime: { reason: "x" } }

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE /downtimes/:id" do
    it "lets a manager delete a record that is over" do
      downtime = create(:asset_downtime, organization: org, asset: asset)

      send_json :delete, "/api/v1/downtimes/#{downtime.id}", as: manager

      expect(response).to have_http_status(:no_content)
      expect(AssetDowntime.exists?(downtime.id)).to be(false)
    end

    it "refuses one that is still going on" do
      downtime = create(:asset_downtime, :open, organization: org, asset: asset)

      send_json :delete, "/api/v1/downtimes/#{downtime.id}", as: manager

      expect(json_body.dig("error", "code")).to eq("STILL_DOWN")
      expect(AssetDowntime.exists?(downtime.id)).to be(true)
    end

    it "is for managers" do
      downtime = create(:asset_downtime, organization: org, asset: asset)

      send_json :delete, "/api/v1/downtimes/#{downtime.id}"

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "the status on the asset" do
    it "opens a downtime when a manager marks it down, and ends it when they mark it operational" do
      patch "/api/v1/assets/#{asset.id}", params: { asset: { status: "down" } }, headers: auth_headers_for(manager)
      expect(asset.downtimes.open.first).to have_attributes(started_by: manager, started_at: now)

      travel 2.hours
      patch "/api/v1/assets/#{asset.id}", params: { asset: { status: "operational" } }, headers: auth_headers_for(manager)
      expect(asset.downtimes.first).to have_attributes(ended_by: manager, ended_at: now + 2.hours)
    end
  end
end
