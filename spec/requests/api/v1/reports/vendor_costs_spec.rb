require "rails_helper"

RSpec.describe "Cost reports with vendor costs", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:pump)    { create(:asset, organization: org, name: "Pump") }
  let(:fan)     { create(:asset, organization: org, name: "Fan") }
  let(:acme)    { create(:vendor, organization: org, name: "Acme Electric") }
  let(:chill)   { create(:vendor, organization: org, name: "Chill Co") }

  def range = { from: 10.days.ago.to_date.iso8601, to: Time.current.to_date.iso8601 }

  def finished(asset: pump, labor: 0, parts: 0, vendor: nil, charged: 0, completed: 2.days.ago)
    create(:work_order, :completed, organization: org, asset: asset, labor_cost: labor, parts_cost: parts, vendor: vendor,
                                    vendor_cost: charged, completed_at: completed, work_order_number: "V-#{SecureRandom.hex(4)}")
  end

  def get_report(name, **params)
    get "/api/v1/reports/costs/#{name}", params: range.merge(params), headers: auth_headers_for(manager)
  end

  before do
    finished(asset: pump, labor: 100, parts: 20)
    finished(asset: pump, vendor: acme, charged: 500, completed: 3.days.ago)
    finished(asset: fan, labor: 10, vendor: acme, charged: 250)
    finished(asset: fan, vendor: chill, charged: 40.5)
  end

  it "adds what vendors charged to the total, and shows it apart from labor and parts" do
    get_report("summary")

    expect(json_body).to include("labor_cost" => 110.0, "parts_cost" => 20.0, "vendor_cost" => 790.5, "total_cost" => 920.5,
                                 "work_orders_count" => 4, "avg_cost_per_wo" => 230.13)
  end

  it "puts the vendor share in each point of the trend" do
    get_report("summary")

    point = json_body["trend"].find { |p| p["period"] == 3.days.ago.to_date.iso8601 }
    expect(point).to include("vendor" => 500.0, "labor" => 0.0, "total" => 500.0)
    expect(json_body["trend"].sum { |p| p["total"] }).to eq(920.5)
  end

  it "includes vendor costs when ranking assets and places" do
    get_report("by_asset")

    expect(json_body["assets"].map { |a| a.slice("asset_name", "vendor_cost", "total_cost") }).to eq([
      { "asset_name" => "Pump", "vendor_cost" => 500.0, "total_cost" => 620.0 },
      { "asset_name" => "Fan", "vendor_cost" => 290.5, "total_cost" => 300.5 }
    ])
    expect(json_body["treemap"]).to eq([{ "name" => "Pump", "cost" => 620.0 }, { "name" => "Fan", "cost" => 300.5 }])
  end

  describe "GET /reports/costs/by_vendor" do
    it "ranks vendors by what they charged for work finished in the period, with the number of jobs" do
      get_report("by_vendor")

      expect(json_body["vendors"]).to eq([
        { "vendor_id" => acme.id, "vendor_name" => "Acme Electric", "vendor_cost" => 750.0, "wo_count" => 2 },
        { "vendor_id" => chill.id, "vendor_name" => "Chill Co", "vendor_cost" => 40.5, "wo_count" => 1 }
      ])
    end

    it "leaves out work finished outside the period, work not finished, and another company's vendors" do
      finished(vendor: chill, charged: 1000, completed: 60.days.ago)
      create(:work_order, organization: org, vendor: chill, vendor_cost: 2000, work_order_number: "OPEN-V")
      elsewhere = create(:organization)
      create(:work_order, :completed, organization: elsewhere, vendor: create(:vendor, organization: elsewhere), vendor_cost: 3000,
                                      completed_at: 1.day.ago, work_order_number: "OTHER-V")

      get_report("by_vendor")

      expect(json_body["vendors"].pluck("vendor_name")).to eq(["Acme Electric", "Chill Co"])
      expect(json_body["vendors"].last["vendor_cost"]).to eq(40.5)
    end

    it "counts a vendor's job even when nothing was charged yet" do
      finished(vendor: create(:vendor, organization: org, name: "Zed"), charged: 0)

      get_report("by_vendor")

      expect(json_body["vendors"].last).to include("vendor_name" => "Zed", "vendor_cost" => 0.0, "wo_count" => 1)
    end

    it "exports as a CSV" do
      get "/api/v1/reports/costs/by_vendor", params: range.merge(format: "csv"), headers: auth_headers_for(manager)

      expect(response).to have_http_status(:ok)
      expect(response.body).to include("vendor,vendor_cost,work_orders").and include("Acme Electric,750.0,2")
    end

    it "is for managers, not technicians" do
      get "/api/v1/reports/costs/by_vendor", params: range, headers: auth_headers_for(create(:user, organization: org))

      expect(response).to have_http_status(:forbidden)
    end
  end

  it "includes the vendor in the per-asset cost analysis and in a work order's total" do
    get "/api/v1/reports/assets/cost_analysis", params: range.merge(from: 30.days.ago.to_date.iso8601),
headers: auth_headers_for(manager)
    rows = json_body["by_asset"].index_by { |r| r["asset_name"] }

    expect(rows["Pump"]).to include("vendor_cost" => 500.0, "total_cost" => 620.0)
    expect(json_body).to include("total_vendor_cost" => 790.5, "total_cost" => 920.5)
  end
end
