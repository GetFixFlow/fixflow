require "rails_helper"

# The Work Orders report screen draws charts that need particular fields. These specs pin the numbers, so a change
# to the report cannot quietly leave the screen with zeros. (The same shapes are loaded by the web app's tests from
# apps/web/src/test/fixtures/reports; see spec/contracts/report_shapes_spec.rb.)
RSpec.describe "Work order report figures", type: :request do
  let(:org)     { create(:organization, settings: { "timezone" => "Asia/Colombo" }) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:alice)   { create(:user, organization: org, first_name: "Alice", last_name: "Silva") }
  let(:bob)     { create(:user, organization: org, first_name: "Bob", last_name: "Perera") }
  let(:place)   { create(:location, organization: org, name: "Plant 1") }
  let(:pump)    { create(:asset, organization: org, name: "Pump", location: place) }
  let(:press)   { create(:asset, organization: org, name: "Press") }
  let(:headers) { auth_headers_for(manager) }
  let(:now)     { Time.utc(2026, 10, 16, 12, 0) }
  let(:window)  { { from: "2026-10-01", to: "2026-10-16" } }

  def make(asset, created:, **attrs)
    notes = %w[completed verified].include?(attrs[:status]) ? { completion_notes: "Done" } : {}
    create(:work_order, organization: org, asset: asset, created_at: created, **notes, **attrs)
  end

  def report(path, **params)
    get "/api/v1/reports/work_orders/#{path}", params: params, headers: headers
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  around { |example| travel_to(now) { example.run } }

  describe "summary" do
    before do
      # 24 hours from creation to completion, 4 hours of work, finished a day late
      make(pump, created: now - 5.days, priority: "high", status: "completed", assignee: alice, started_at: now - 4.days - 4.hours,
                 completed_at: now - 4.days, due_date: now - 5.days)
      # 2 hours from creation to completion, on time
      make(pump, created: now - 5.days, priority: "high", status: "verified", assignee: bob, started_at: now - 5.days + 1.hour,
                 completed_at: now - 5.days + 2.hours, due_date: now + 1.day)
      make(press, created: now - 3.days, priority: "critical", status: "open", due_date: now - 1.day)
      make(press, created: now - 3.days, priority: "low", status: "open")
    end

    it "gives the average resolution time as a number, not text" do
      body = report("summary", **window)
      expect(body["totals"]["avg_resolution_hours"]).to be_a(Float).and eq(13.0)
    end

    it "counts, for each priority, what was created, finished and is still open, with the share that missed the due date" do
      detail = report("summary", **window)["by_priority_detail"].index_by { |row| row["priority"] }
      expect(detail.keys).to eq(%w[critical high medium low])
      expect(detail["high"]).to include("created" => 2, "completed" => 2, "open" => 0, "avg_hours" => 2.5, "overdue_pct" => 50.0)
      expect(detail["critical"]).to include("created" => 1, "completed" => 0, "open" => 1, "overdue_pct" => 100.0)
      expect(detail["low"]).to include("created" => 1, "open" => 1, "overdue_pct" => 0)
      expect(detail["medium"]).to include("created" => 0, "avg_hours" => 0, "overdue_pct" => 0)
    end

    it "has a trend with a created, completed and resolution_hours value for each day that had anything" do
      trend = report("summary", **window)["trend"]
      expect(trend.pluck("date")).to eq(%w[2026-10-11 2026-10-12 2026-10-13])
      expect(trend.first).to eq("date" => "2026-10-11", "created" => 2, "completed" => 1, "resolution_hours" => 2.0)
    end

    it "groups the trend by company-local day (Colombo is 5h30 ahead of UTC)" do
      make(pump, created: Time.utc(2026, 10, 14, 20, 0), status: "completed", completed_at: Time.utc(2026, 10, 14, 21, 0))
      days = report("summary", **window)["trend"].pluck("date")
      expect(days).to include("2026-10-15") # 02:00 and 03:00 local on the 15th, though 20:00 and 21:00 UTC on the 14th
      expect(days).not_to include("2026-10-14")
    end

    it "groups the trend by week or month when asked" do
      months = report("summary", **window, group_by: "month")["trend"]
      expect(months).to contain_exactly(include("date" => "2026-10-01", "created" => 4, "completed" => 2))
    end

    it "draws the heatmap from completions of the last 13 weeks, by company-local day, following the Filters but not the period" do
      make(pump, created: now - 90.days, status: "completed", completed_at: now - 20.days)
      make(pump, created: now - 200.days, status: "completed", completed_at: now - 100.days)
      # 20:30 UTC on the 14th is 02:00 on the 15th in Colombo
      make(pump, created: now - 9.days, status: "completed", completed_at: Time.utc(2026, 10, 14, 20, 30))
      body = report("summary", from: "2026-10-15", to: "2026-10-16")
      expect(body["completion_heatmap"]).to eq(
        [{ "date" => "2026-09-26", "count" => 1 }, { "date" => "2026-10-11", "count" => 1 },
         { "date" => "2026-10-12", "count" => 1 }, { "date" => "2026-10-15", "count" => 1 }]
      )
      filtered = report("summary", from: "2026-10-15", to: "2026-10-16", asset_ids: [press.id])
      expect(filtered["completion_heatmap"]).to eq([])
    end
  end

  describe "mttr" do
    before do
      make(pump, created: now - 5.days, status: "completed", assignee: alice, started_at: now - 10.hours, completed_at: now - 4.hours)
      make(pump, created: now - 5.days, status: "verified", assignee: alice, started_at: now - 10.hours, completed_at: now - 6.hours)
      make(press, created: now - 5.days, status: "completed", assignee: bob, started_at: now - 20.hours, completed_at: now - 2.hours)
      # not counted: never started, or not finished
      make(press, created: now - 5.days, status: "completed", assignee: bob, completed_at: now - 2.hours)
      make(press, created: now - 5.days, status: "in_progress", assignee: bob, started_at: now - 3.hours)
    end

    it "gives the overall average and the rows for each grouping, slowest first, with numbers" do
      body = report("mttr", **window)
      expect(body["overall_avg"]).to eq(9.3)
      expect(body["by_group"]["asset"]).to eq(
        [{ "name" => "Press", "wo_count" => 1, "avg_hours" => 18.0, "min_hours" => 18.0, "max_hours" => 18.0 },
         { "name" => "Pump", "wo_count" => 2, "avg_hours" => 5.0, "min_hours" => 4.0, "max_hours" => 6.0 }]
      )
      expect(body["by_group"]["technician"].map { |row| [row["name"], row["wo_count"]] }).to eq([["Bob Perera", 1], ["Alice Silva", 2]])
    end

    it "groups by place, leaving out assets that have none" do
      expect(report("mttr", **window)["by_group"]["location"]).to eq(
        [{ "name" => "Plant 1", "wo_count" => 2, "avg_hours" => 5.0, "min_hours" => 4.0, "max_hours" => 6.0 }]
      )
    end

    it "follows the Filters" do
      body = report("mttr", **window, asset_ids: [pump.id])
      expect(body["by_group"]["asset"].pluck("name")).to eq(["Pump"])
      expect(body["overall_avg"]).to eq(5.0)
    end

    it "is zero, not an error, with nothing finished" do
      body = report("mttr", from: "2026-01-01", to: "2026-01-02")
      expect(body).to eq("overall_avg" => 0.0, "by_group" => { "asset" => [], "location" => [], "technician" => [] })
    end
  end

  describe "backlog" do
    before do
      make(pump, created: now - 2.days, priority: "critical", status: "open", title: "Leak")
      make(pump, created: now - 8.days, priority: "high", status: "assigned", assignee: alice, title: "Noise")
      make(press, created: now - 8.days, priority: "high", status: "on_hold")
      make(press, created: now - 40.days, priority: "low", status: "pending_parts", title: "Old rust")
      make(press, created: now - 40.days, priority: "low", status: "completed", completed_at: now - 1.day)
    end

    it "counts open work orders of each priority in each age band" do
      body = report("backlog")
      expect(body["total_open"]).to eq(4)
      expect(body["aging"]).to eq(
        [{ "bucket" => "0-7 days", "critical" => 1, "high" => 0, "medium" => 0, "low" => 0 },
         { "bucket" => "8-14 days", "critical" => 0, "high" => 2, "medium" => 0, "low" => 0 },
         { "bucket" => "15-30 days", "critical" => 0, "high" => 0, "medium" => 0, "low" => 0 },
         { "bucket" => "Over 30 days", "critical" => 0, "high" => 0, "medium" => 0, "low" => 1 }]
      )
    end

    it "lists the oldest open work orders with how long they have been open" do
      oldest = report("backlog")["oldest_wos"]
      expect(oldest.first).to include(
        "title" => "Old rust", "asset_name" => "Press", "priority" => "low", "days_open" => 40, "assignee_name" => nil
      )
      expect(oldest.first.keys).to include("id", "work_order_number")
      expect(oldest.pluck("days_open")).to eq([40, 8, 8, 2])
      expect(oldest.find { |row| row["title"] == "Noise" }["assignee_name"]).to eq("Alice Silva")
    end

    it "follows the Filters" do
      body = report("backlog", priorities: ["high"])
      expect(body["total_open"]).to eq(2)
      expect(body["aging"].sum { |row| row["critical"] + row["low"] }).to eq(0)
    end
  end

  describe "technician performance" do
    before do
      worked = { status: "completed", assignee: alice, started_at: now - 10.hours }
      make(pump, created: now - 5.days, priority: "high", completed_at: now - 6.hours, **worked)
      make(press, created: now - 5.days, priority: "low", completed_at: now - 4.hours, **worked)
      make(pump, created: now - 5.days, priority: "high", status: "open", assignee: bob)
    end

    def rows(**params)
      report("technician_performance", **window, **params)["technicians"].index_by { |row| row["name"] }
    end

    it "gives the average hours as a number" do
      expect(rows["Alice Silva"]["avg_resolution_hours"]).to be_a(Float).and eq(5.0)
      expect(rows["Bob Perera"]["avg_resolution_hours"]).to eq(0)
    end

    it "follows the period" do
      earlier = report("technician_performance", from: "2026-01-01", to: "2026-01-02")["technicians"]
      expect(earlier.sum { |row| row["assigned"] }).to eq(0)
    end

    it "follows the Filters panel's assets, priorities and people" do
      expect(rows(asset_ids: [pump.id])["Alice Silva"]).to include("assigned" => 1, "completed" => 1)
      expect(rows(priorities: ["low"])["Bob Perera"]).to include("assigned" => 0)
      expect(rows(user_ids: [bob.id]).keys).to eq(["Bob Perera"])
    end
  end
end
