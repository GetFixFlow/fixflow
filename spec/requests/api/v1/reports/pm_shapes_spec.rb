require "rails_helper"

# The PM compliance screen: what counts against compliance, and the Filters panel.
RSpec.describe "PM report figures", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:alice)   { create(:user, organization: org, first_name: "Alice", last_name: "Silva") }
  let(:plant)   { create(:location, organization: org, name: "Plant 1") }
  let(:annex)   { create(:location, organization: org, name: "Annex") }
  let(:pump)    { create(:asset, organization: org, name: "Pump", location: plant) }
  let(:press)   { create(:asset, organization: org, name: "Press", location: annex) }
  let(:pump_pm) { create(:preventive_maintenance, organization: org, asset: pump, assigned_to: alice, next_due_at: now + 3.days) }
  let(:press_pm) { create(:preventive_maintenance, organization: org, asset: press, next_due_at: now - 2.days) }
  let(:now)     { Time.utc(2026, 10, 16, 12, 0) }

  def window = { from: "2026-09-16", to: "2026-10-16" }

  def report(path, **params)
    get "/api/v1/reports/pm/#{path}", params: params, headers: auth_headers_for(manager)
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  def run(schedule, status, days_ago)
    create(:pm_execution, status, preventive_maintenance: schedule, scheduled_date: now.to_date - days_ago)
  end

  around { |example| travel_to(now) { example.run } }

  describe "compliance" do
    before do
      run(pump_pm, :completed, 20)
      run(pump_pm, :completed, 10)
      run(pump_pm, :skipped, 8)
      run(pump_pm, :generated, 6)  # past its date, never done: missed
      run(pump_pm, :pending, 0)    # due today, not yet missed: left out of the rate
      run(press_pm, :generated, 5) # missed
      run(press_pm, :pending, 4)   # missed
    end

    it "counts skipped and missed maintenance against the rate, and leaves out what is not due yet" do
      body = report("compliance", **window)
      expect(body["summary"]).to eq("scheduled" => 7, "completed" => 2, "skipped" => 1, "missed" => 3)
      expect(body["overall_compliance_rate"]).to eq(33.3)
    end

    it "gives the rate for each month, each place and each asset in the same way" do
      body = report("compliance", **window)
      expect(body["by_month"]).to contain_exactly(
        { "month" => "2026-09", "scheduled" => 1, "completed" => 1, "skipped" => 0, "missed" => 0, "compliance_rate" => 100.0 },
        { "month" => "2026-10", "scheduled" => 6, "completed" => 1, "skipped" => 1, "missed" => 3, "compliance_rate" => 20.0 }
      )
      expect(body["by_location"].pluck("location", "compliance_rate")).to eq([["Annex", 0.0], ["Plant 1", 50.0]])
      expect(body["worst_performing_assets"].first).to eq(
        "asset_name" => "Press", "total" => 2, "completed" => 0, "missed" => 2, "compliance_rate" => 0.0
      )
    end

    it "is null, not 0 or 100, when nothing has come due" do
      run(pump_pm, :pending, -3) # due in three days
      body = report("compliance", from: "2026-10-17", to: "2026-10-30")
      expect(body["overall_compliance_rate"]).to be_nil
      expect(body["summary"]).to eq("scheduled" => 1, "completed" => 0, "skipped" => 0, "missed" => 0)
      expect(body["by_month"].first["compliance_rate"]).to be_nil
    end

    it "follows the Filters panel's assets and places, in every part of the answer" do
      body = report("compliance", **window, location_ids: [plant.id])
      expect(body["summary"]).to include("scheduled" => 5, "completed" => 2, "missed" => 1)
      expect(body["by_location"].pluck("location")).to eq(["Plant 1"])
      expect(body["worst_performing_assets"].pluck("asset_name")).to eq(["Pump"])

      body = report("compliance", **window, asset_ids: [press.id])
      expect(body["summary"]).to include("scheduled" => 2, "completed" => 0, "missed" => 2)
      expect(body["overall_compliance_rate"]).to eq(0.0)
    end

    it "counts what has just happened, without waiting for a cache to expire" do
      allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)
      expect(report("compliance", **window)["summary"]["completed"]).to eq(2)
      run(pump_pm, :completed, 2)
      expect(report("compliance", **window)["summary"]["completed"]).to eq(3)
    end
  end

  describe "schedule forecast" do
    before do
      pump_pm
      press_pm
    end

    it "lists the schedules due soon, with how often each repeats and who has it" do
      row = report("schedule_forecast", days: 30)["by_week"].flat_map { |week| week["pms"] }.find { |pm| pm["pm_id"] == pump_pm.id }
      expect(row).to include("frequency_type" => "time_based", "frequency_value" => 30, "frequency_unit" => "days",
                             "assigned_to" => "Alice Silva", "asset" => "Pump", "due_date" => "2026-10-19")
    end

    it "follows the Filters panel's assets, places and people" do
      ids = ->(**params) { report("schedule_forecast", days: 30, **params)["by_week"].flat_map { |week| week["pms"].pluck("pm_id") } }
      expect(ids.call).to contain_exactly(pump_pm.id, press_pm.id)
      expect(ids.call(location_ids: [annex.id])).to eq([press_pm.id])
      expect(ids.call(asset_ids: [pump.id])).to eq([pump_pm.id])
      expect(ids.call(user_ids: [alice.id])).to eq([pump_pm.id])
    end
  end
end
