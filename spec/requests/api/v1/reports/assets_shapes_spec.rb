require "rails_helper"

# The Asset Health screen needs particular fields, and its Filters panel has to change what it shows.
RSpec.describe "Asset report figures", type: :request do
  let(:org)     { create(:organization, settings: { "timezone" => "Asia/Colombo" }) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:plant)   { create(:location, organization: org, name: "Plant 1") }
  let(:annex)   { create(:location, organization: org, name: "Annex") }
  let!(:pump)   { create(:asset, organization: org, name: "Pump", location: plant, status: "operational") }
  let!(:press)  { create(:asset, organization: org, name: "Press", location: annex, status: "down") }
  let(:fan)     { create(:asset, organization: org, name: "Fan", location: plant, status: "degraded") }
  let(:headers) { auth_headers_for(manager) }
  let(:now)     { Time.utc(2026, 10, 16, 12, 0) }

  def get_json(path, **params)
    get "/api/v1/reports/#{path}", params: params, headers: headers
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  before { fan }

  around { |example| travel_to(now) { example.run } }

  describe "health" do
    before do
      create(:work_order, organization: org, asset: pump, status: "open")
      create(:work_order, organization: org, asset: pump, status: "assigned")
      create(:work_order, organization: org, asset: pump, status: "completed", completion_notes: "Done", completed_at: now)
      create(:work_order, organization: org, asset: press, status: "open")
      rule = create(:iot_rule, organization: org, asset: press)
      create(:iot_alert, iot_rule: rule, asset: press, status: :open)
      create(:iot_alert, iot_rule: rule, asset: press, status: :resolved)
    end

    it "gives the counts by status the screen reads" do
      body = get_json("assets/health")
      expect(body["total"]).to eq(3)
      expect(body["by_status"]).to include("operational" => 1, "degraded" => 1, "down" => 1)
    end

    it "lists every asset with its status, place and work and alert counts, those needing attention first" do
      rows = get_json("assets/health")["assets"]
      expect(rows.pluck("name")).to eq(%w[Press Fan Pump])
      expect(rows.first).to include("id" => press.id, "asset_tag" => press.asset_tag, "status" => "down", "location" => "Annex",
                                    "open_work_orders" => 1, "total_work_orders" => 1, "sensor_alerts" => 1)
      expect(rows.last).to include("status" => "operational", "location" => "Plant 1",
                                   "open_work_orders" => 2, "total_work_orders" => 3, "sensor_alerts" => 0)
    end

    it "follows the Filters panel's places and assets, in every part of the answer" do
      body = get_json("assets/health", location_ids: [plant.id])
      expect(body["total"]).to eq(2)
      expect(body["assets"].pluck("name")).to eq(%w[Fan Pump])
      expect(body["by_location"].pluck("location")).to eq(["Plant 1"])
      expect(body["most_maintained"].pluck("name")).to eq(["Pump"])
      expect(body["recently_degraded"].pluck("name")).to eq(["Fan"])

      expect(get_json("assets/health", asset_ids: [press.id])["assets"].pluck("name")).to eq(["Press"])
      expect(get_json("assets/health", status: "down")["assets"].pluck("name")).to eq(["Press"])
    end

    it "counts what has just happened, without waiting for a cache to expire" do
      allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)
      expect(get_json("assets/health")["total"]).to eq(3)
      create(:asset, organization: org, name: "New", status: "operational")
      expect(get_json("assets/health")["total"]).to eq(4)
      expect(get_json("assets/health", location_ids: [annex.id])["total"]).to eq(1)
    end

    it "does not list another company's assets" do
      create(:asset, name: "Their pump")
      expect(get_json("assets/health")["assets"].pluck("name")).not_to include("Their pump")
    end
  end

  describe "history" do
    before do
      worked = { status: "completed", completion_notes: "Done", created_at: now - 3.days, started_at: now - 10.hours }
      create(:work_order, organization: org, asset: pump, completed_at: now - 6.hours, labor_cost: 100, parts_cost: 20.5, **worked)
      create(:work_order, organization: org, asset: pump, completed_at: now - 2.hours, labor_cost: 0, parts_cost: 0, **worked)
      # made by a schedule, in September
      schedule = create(:preventive_maintenance, organization: org, asset: pump)
      create(:work_order, organization: org, asset: pump, created_at: Time.utc(2026, 9, 10), preventive_maintenance: schedule)
      rule = create(:iot_rule, organization: org, asset: pump)
      create(:iot_alert, iot_rule: rule, asset: pump, created_at: Time.utc(2026, 8, 20))
      # the time it was out of action (not the hours spent repairing it, which is 12): 5 and 9 hours
      create(:asset_downtime, organization: org, asset: pump, started_at: now - 30.hours, ended_at: now - 25.hours)
      create(:asset_downtime, organization: org, asset: pump, started_at: now - 14.hours, ended_at: now - 5.hours)
    end

    it "gives the figures as numbers, with the average hours of work" do
      summary = get_json("assets/#{pump.id}/history")["summary"]
      expect(summary).to include("total_work_orders" => 3, "avg_resolution_hours" => 6.0, "total_downtime_hours" => 14.0,
                                 "total_maintenance_cost" => 120.5, "iot_alerts_total" => 1)
      expect(summary.values_at("total_downtime_hours", "total_maintenance_cost", "avg_resolution_hours")).to all(be_a(Float))
    end

    it "gives the last twelve months, none left out, with scheduled work, other work and alerts apart" do
      months = get_json("assets/#{pump.id}/history")["monthly"]
      expect(months.pluck("month")).to eq((0..11).map { |n| Date.new(2025, 11, 1).next_month(n).iso8601 })
      by_month = months.index_by { |row| row["month"] }
      expect(by_month["2026-10-01"]).to eq("month" => "2026-10-01", "corrective" => 2, "pm" => 0, "iot" => 0)
      expect(by_month["2026-09-01"]).to include("corrective" => 0, "pm" => 1)
      expect(by_month["2026-08-01"]).to include("iot" => 1)
      expect(by_month["2025-11-01"]).to include("corrective" => 0, "pm" => 0, "iot" => 0)
    end
  end
end
