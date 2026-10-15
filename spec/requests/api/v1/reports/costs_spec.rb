require "rails_helper"

RSpec.describe "Cost reports", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:plant)      { create(:location, organization: org, name: "Plant") }
  let(:floor)      { create(:location, organization: org, name: "Floor 1", parent: plant) }
  let(:annex)      { create(:location, organization: org, name: "Annex") }
  let(:pump)       { create(:asset, organization: org, name: "Pump", location: floor) }
  let(:fan)        { create(:asset, organization: org, name: "Fan", location: annex) }
  let(:counter)    { [0] }

  def range = { from: 10.days.ago.to_date.iso8601, to: Time.current.to_date.iso8601 }

  # A finished work order with known costs; work_order_number is given so numbers never collide.
  def finished(asset: pump, labor: 0, parts: 0, completed: 2.days.ago, created: 20.days.ago, **extra)
    number = "C-#{SecureRandom.hex(4)}"
    create(:work_order, :completed, organization: org, asset: asset, labor_cost: labor, parts_cost: parts,
                                    completed_at: completed, created_at: created, work_order_number: number, **extra)
  end

  def get_report(name, as: manager, **params)
    get "/api/v1/reports/costs/#{name}", params: range.merge(params), headers: auth_headers_for(as)
  end

  before do
    finished(asset: pump, labor: 100, parts: 20, completed: 3.days.ago)
    finished(asset: pump, labor: 50, parts: 30, completed: 1.day.ago)
    finished(asset: fan, labor: 0, parts: 40, completed: 2.days.ago)
    finished(asset: nil, labor: 10, parts: 0, completed: 2.days.ago)
  end

  describe "GET /reports/costs/summary" do
    it "totals what finished work cost, with labor and parts apart, and the average per work order" do
      get_report("summary")

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("total_cost" => 250.0, "labor_cost" => 160.0, "parts_cost" => 90.0, "work_orders_count" => 4,
"avg_cost_per_wo" => 62.5)
    end

    it "counts a cost in the period the work was finished, not when the work order was opened" do
      finished(labor: 1000, completed: 1.day.ago, created: 400.days.ago) # opened long ago, finished in the period
      finished(labor: 5000, completed: 30.days.ago, created: 5.days.ago) # opened in the period, finished before it

      get_report("summary")

      expect(json_body["labor_cost"]).to eq(1160.0)
    end

    it "counts only finished work: completed or verified, not open, cancelled or in progress" do
      create(:work_order, organization: org, asset: pump, parts_cost: 999, work_order_number: "OPEN-1")
      create(:work_order, :cancelled, organization: org, asset: pump, parts_cost: 888, work_order_number: "CAN-1")
      create(:work_order, :verified, organization: org, asset: pump, parts_cost: 7, completed_at: 1.day.ago, work_order_number: "VER-1")

      get_report("summary")

      expect(json_body["parts_cost"]).to eq(97.0)
    end

    it "is zeros, not an error, when nothing was finished" do
      get_report("summary", from: 400.days.ago.to_date.iso8601, to: 300.days.ago.to_date.iso8601)

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("total_cost" => 0.0, "work_orders_count" => 0, "avg_cost_per_wo" => 0.0)
    end

    it "gives a point for every day of a short period, empty days included, so a chart has no gaps" do
      get_report("summary")

      trend = json_body["trend"]
      expect(json_body["group_by"]).to eq("day")
      expect(trend.size).to eq(11)
      expect(trend.sum { |p| p["total"] }).to eq(250.0)
      expect(trend.find { |p|
        p["period"] == 3.days.ago.to_date.iso8601
      }).to include("labor" => 100.0, "parts" => 20.0, "total" => 120.0, "wo_count" => 1)
      expect(trend.count { |p| p["wo_count"].zero? }).to eq(8)
    end

    it "groups by week for a period of a few months, and by month for a year, unless told otherwise" do
      get_report("summary", from: 100.days.ago.to_date.iso8601)
      expect(json_body["group_by"]).to eq("week")
      expect(json_body["trend"].sum { |p| p["total"] }).to eq(250.0)

      get_report("summary", from: 400.days.ago.to_date.iso8601)
      expect(json_body["group_by"]).to eq("month")

      get_report("summary", group_by: "week")
      expect(json_body["group_by"]).to eq("week")
    end

    it "is not fooled by a group_by it does not know" do
      get_report("summary", group_by: "year; DROP TABLE work_orders")

      expect(response).to have_http_status(:ok)
      expect(json_body["group_by"]).to eq("day")
    end

    it "refuses a period that ends before it starts" do
      get_report("summary", from: "2026-10-10", to: "2026-10-01")

      expect(response).to have_http_status(:bad_request)
    end

    it "never includes another company's work" do
      other = create(:organization)
      create(:work_order, :completed, organization: other, asset: nil, labor_cost: 9999, completed_at: 1.day.ago,
work_order_number: "OTHER-1")

      get_report("summary")

      expect(json_body["total_cost"]).to eq(250.0)
    end
  end

  describe "GET /reports/costs/by_asset" do
    it "ranks assets by what their work cost, with the split and the number of jobs" do
      get_report("by_asset")

      expect(json_body["assets"].map { |a| a.slice("asset_name", "labor_cost", "parts_cost", "total_cost", "wo_count") }).to eq([
        { "asset_name" => "Pump", "labor_cost" => 150.0, "parts_cost" => 50.0, "total_cost" => 200.0, "wo_count" => 2 },
        { "asset_name" => "Fan", "labor_cost" => 0.0, "parts_cost" => 40.0, "total_cost" => 40.0, "wo_count" => 1 },
        { "asset_name" => "No asset", "labor_cost" => 10.0, "parts_cost" => 0.0, "total_cost" => 10.0, "wo_count" => 1 }
      ])
    end

    it "gives the treemap the same costs, leaving out what cost nothing" do
      finished(asset: create(:asset, organization: org, name: "Free"), labor: 0, parts: 0)

      get_report("by_asset")

      expect(json_body["treemap"]).to eq([{ "name" => "Pump", "cost" => 200.0 }, { "name" => "Fan", "cost" => 40.0 },
                                          { "name" => "No asset", "cost" => 10.0 }])
      expect(json_body["total_assets"]).to eq(4)
    end

    it "gathers the smallest into Other when there are many" do
      stub_const("CostReport::TREEMAP_ITEMS", 1)

      get_report("by_asset")

      expect(json_body["treemap"]).to eq([{ "name" => "Pump", "cost" => 200.0 }, { "name" => "Other", "cost" => 50.0 }])
    end
  end

  describe "GET /reports/costs/by_location" do
    it "groups the cost by where the work was, by full path" do
      get_report("by_location")

      expect(json_body["locations"].map { |l|
        [l["location_name"], l["total_cost"]]
      }).to eq([["Plant > Floor 1", 200.0], ["Annex", 40.0], ["No location", 10.0]])
    end
  end

  describe "the Filters panel" do
    before do
      finished(asset: pump, labor: 1, parts: 0, priority: "critical",
preventive_maintenance: create(:preventive_maintenance, organization: org, asset: pump), completed: 1.day.ago)
      finished(asset: fan, labor: 2, parts: 0, completed: 1.day.ago, assignee: technician)
    end

    def labor_total(**params) = get_report("summary", **params) && json_body["labor_cost"]

    it "narrows to places, and what is inside them" do
      expect(labor_total(location_ids: [plant.id])).to eq(151.0)
      expect(labor_total(location_ids: [annex.id])).to eq(2.0)
      expect(labor_total(location_ids: [plant.id, annex.id])).to eq(153.0)
    end

    it "narrows to assets" do
      expect(labor_total(asset_ids: [fan.id])).to eq(2.0)
    end

    it "narrows to the people who did the work" do
      expect(labor_total(user_ids: [technician.id])).to eq(2.0)
    end

    it "narrows to priorities" do
      expect(labor_total(priorities: ["critical"])).to eq(1.0)
    end

    it "narrows to where the work order came from" do
      expect(labor_total(sources: ["pm"])).to eq(1.0)
      expect(labor_total(sources: ["manual"])).to eq(162.0) # everything made by hand: all but the one from a schedule
      expect(labor_total(sources: %w[pm manual])).to eq(163.0)
      expect(labor_total(sources: ["iot"])).to eq(0.0)
    end

    it "combines filters, each narrowing further" do
      expect(labor_total(location_ids: [plant.id], priorities: ["critical"])).to eq(1.0)
      expect(labor_total(asset_ids: [pump.id], location_ids: [annex.id])).to eq(0.0)
    end

    it "still takes the single values older callers send" do
      expect(labor_total(asset_id: fan.id)).to eq(2.0)
      expect(labor_total(location_id: annex.id)).to eq(2.0)
      expect(labor_total(assignee_id: technician.id)).to eq(2.0)
    end

    it "ignores ids that are not this company's, finding nothing rather than leaking" do
      foreign = create(:location)
      expect(labor_total(location_ids: [foreign.id])).to eq(0.0)
      expect(labor_total(asset_ids: [create(:asset).id])).to eq(0.0)
    end

    it "finds nothing for a priority that does not exist, rather than showing everything" do
      expect(labor_total(priorities: ["urgent!"])).to eq(0.0)
      expect(labor_total(priorities: ["urgent!", "critical"])).to eq(1.0)
    end

    it "finds nothing for a source that does not exist, without failing" do
      expect(labor_total(sources: ["carrier pigeon"])).to eq(0.0)
    end

    it "also applies to the work order reports, which ignored it before" do
      wide = { from: 40.days.ago.to_date.iso8601, to: Time.current.to_date.iso8601 }

      get "/api/v1/reports/work_orders/summary", params: wide, headers: auth_headers_for(manager)
      everything = json_body.dig("totals", "created")
      get "/api/v1/reports/work_orders/summary", params: wide.merge(priorities: ["critical"]), headers: auth_headers_for(manager)

      expect(everything).to eq(6)
      expect(json_body.dig("totals", "created")).to eq(1)
    end
  end

  describe "who may see costs" do
    it "not technicians or requesters, who must not be able to work out what people are paid" do
      [technician, create(:user, :requester, organization: org)].each do |person|
        %w[summary by_asset by_location].each do |name|
          get_report(name, as: person)
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    it "and the older report endpoints that carry labor cost are closed to them too" do
      ["/api/v1/reports/assets/cost_analysis", "/api/v1/reports/assets/health", "/api/v1/reports/work_orders/summary"].each do |path|
        get path, params: range, headers: auth_headers_for(technician)
        expect(response).to have_http_status(:forbidden), "#{path} should be closed to technicians"
      end
    end

    it "not people who are signed out" do
      get "/api/v1/reports/costs/summary", params: range

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
