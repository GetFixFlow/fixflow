require "rails_helper"

RSpec.describe "Sites report", type: :request do
  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:north)   { create(:location, organization: org, name: "North", location_type: "site") }
  let(:south)   { create(:location, organization: org, name: "South", location_type: "site") }
  let(:north_hall) { create(:location, organization: org, name: "North hall", location_type: "building", parent: north) }
  let(:south_hall) { create(:location, organization: org, name: "South hall", location_type: "building", parent: south) }
  let(:now) { Time.zone.parse("2026-11-15 12:00") }
  let!(:north_asset) { create(:asset, organization: org, name: "North pump", location: north_hall) }
  let!(:south_asset) { create(:asset, organization: org, name: "South pump", location: south_hall) }
  let!(:shared_asset) { create(:asset, organization: org, name: "Yard pump") } # rubocop:disable RSpec/LetSetup -- the report counts it

  def get_report(as: manager,
                 **params)
    get("/api/v1/reports/sites", params: { from: "2026-11-01", to: "2026-11-15" }.merge(params),
  headers: auth_headers_for(as))
  end

  def data = json_body["data"]
  def row(name) = data["sites"].find { |site| site["name"] == name }

  def finished(asset, cost:, at: "2026-11-10 10:00")
    create(:work_order, organization: org, asset: asset, status: "completed", completed_at: Time.zone.parse(at),
                        completion_notes: "Done",
                        labor_cost: cost, parts_cost: 5, vendor_cost: 1)
  end

  around { |example| travel_to(now) { example.run } }

  before do
    SiteMembership.create!(user: create(:user, organization: org), site: north)
    create(:work_order, organization: org, asset: north_asset, status: "open", due_date: 2.days.ago)
    create(:work_order, organization: org, asset: north_asset, status: "in_progress", due_date: 3.days.from_now)
    create(:work_order, organization: org, asset: south_asset, status: "open")
    create(:work_order, organization: org, asset: nil, status: "open")
    finished(north_asset, cost: 100)
    finished(south_asset, cost: 20)
    finished(north_asset, cost: 1000, at: "2026-09-01 10:00") # before the period
    south
  end

  it "is for managers and administrators" do
    get_report(as: create(:user, organization: org))
    expect(response).to have_http_status(:forbidden)
    get "/api/v1/reports/sites"
    expect(response).to have_http_status(:unauthorized)
  end

  it "puts each site on a line, with its assets, open and overdue work, finished work and what it cost, and its people" do
    get_report

    expect(response).to have_http_status(:ok)
    expect(data["sites"].pluck("name")).to eq(%w[North South])
    expect(row("North")).to include("assets" => 1, "open_work_orders" => 2, "overdue_work_orders" => 1, "completed_work_orders" => 1,
"total_cost" => 106.0, "people" => 1)
    expect(row("South")).to include("assets" => 1, "open_work_orders" => 1, "overdue_work_orders" => 0, "completed_work_orders" => 1,
"total_cost" => 26.0, "people" => 0)
  end

  it "counts finished work in the period only" do
    get_report(from: "2026-08-25", to: "2026-09-05")

    expect(row("North")).to include("completed_work_orders" => 1, "total_cost" => 1006.0)
    expect(row("South")).to include("completed_work_orders" => 0, "total_cost" => 0.0)
  end

  it "has a line for what is in no site, work with no asset included, and a total" do
    get_report

    expect(data["shared"]).to include("name" => nil, "assets" => 1, "open_work_orders" => 1, "people" => nil)
    expect(data["total"]).to include("assets" => 3, "open_work_orders" => 4, "completed_work_orders" => 2, "total_cost" => 132.0)
  end

  it "says how available the assets were, and how long they were down" do
    north_asset.update_columns(created_at: 30.days.ago) # rubocop:disable Rails/SkipsModelValidations -- an asset counts from the day it was added
    create(:asset_downtime, asset: north_asset, organization: org, started_at: Time.zone.parse("2026-11-05 00:00"),
ended_at: Time.zone.parse("2026-11-06 00:00"))

    get_report

    expect(row("North")["downtime_hours"]).to eq(24.0)
    expect(row("North")["failures"]).to eq(1)
    expect(row("North")["availability"]).to be < 100
    expect(row("South")["availability"]).to eq(100.0)
  end

  it "shows a manager who works at one site only that site and what is shared, never the other" do
    org.update!(settings: org.settings.merge("sites_enabled" => true))
    SiteMembership.create!(user: manager, site: north)

    get_report

    expect(data["sites"].pluck("name")).to eq(["North"])
    expect(data["total"]).to include("assets" => 2)
    expect(response.body).not_to include("South pump")
  end

  it "is just the shared line, with everything in it, for a company with no sites" do
    bare = create(:organization)
    create(:asset, organization: bare)
    create(:asset, organization: bare, location: create(:location, organization: bare, location_type: "building"))

    get_report(as: create(:user, :manager, organization: bare))

    expect(data["sites"]).to eq([])
    expect(data["shared"]).to include("assets" => 2)
    expect(data["total"]).to include("assets" => 2)
  end
end
