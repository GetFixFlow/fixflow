require "rails_helper"

# The Downtime report screen reads these fields, its Filters panel narrows what it shows, and the file it exports holds
# the same table. (The arithmetic is in spec/services/downtime_report_spec.rb.)
RSpec.describe "Downtime report", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:plant)      { create(:location, organization: org, name: "Plant 1") }
  let(:annex)      { create(:location, organization: org, name: "Annex") }
  let(:now)        { Time.utc(2026, 10, 16, 12, 0) }
  let!(:pump)      { create(:asset, organization: org, name: "Pump", location: plant, created_at: now - 60.days) }
  let(:press)      { create(:asset, organization: org, name: "=Press", location: annex, created_at: now - 60.days) }

  around { |example| travel_to(now) { example.run } }

  before do
    press
    create(:asset_downtime, organization: org, asset: pump, started_at: now - 4.days, ended_at: now - 3.days, reason: "Fuse")
  end

  def get_json(**params)
    get "/api/v1/reports/assets/downtime", params: { from: "2026-10-06T12:00:00Z", to: "2026-10-16T12:00:00Z", **params },
                                           headers: auth_headers_for(manager)
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  it "gives the figures for the period, each asset and all of them" do
    body = get_json

    expect(body["period"]).to eq("from" => "2026-10-06", "to" => "2026-10-16")
    expect(body["summary"]).to eq("availability" => 95.0, "downtime_hours" => 24.0, "failures" => 1, "mtbf_hours" => 456.0,
                                  "mttr_hours" => 24.0, "assets" => 2, "down_now" => 0)
    expect(body["assets"].first).to eq("id" => pump.id, "name" => "Pump", "asset_tag" => pump.asset_tag, "location" => "Plant 1",
                                       "availability" => 90.0, "downtime_hours" => 24.0, "failures" => 1, "mtbf_hours" => 216.0,
                                       "mttr_hours" => 24.0, "down_now" => false)
    expect(body["assets"].last).to include("name" => "=Press", "availability" => 100.0, "mtbf_hours" => nil)
  end

  it "narrows to the places and assets the Filters panel chose" do
    expect(get_json(location_ids: [annex.id])["assets"].pluck("name")).to eq(["=Press"])
    expect(get_json(asset_ids: [pump.id])["summary"]).to include("assets" => 1, "availability" => 90.0)
  end

  it "defaults to the last 30 days" do
    get "/api/v1/reports/assets/downtime", headers: auth_headers_for(manager)

    expect(response.parsed_body["period"]).to eq("from" => "2026-09-16", "to" => "2026-10-16")
  end

  it "refuses a period that ends before it begins" do
    get "/api/v1/reports/assets/downtime", params: { from: "2026-10-10", to: "2026-10-01" }, headers: auth_headers_for(manager)

    expect(response).to have_http_status(:bad_request)
  end

  it "is a CSV file with the same table, keeping a name that looks like a formula as text" do
    get "/api/v1/reports/assets/downtime.csv", params: { from: "2026-10-06T12:00:00Z", to: "2026-10-16T12:00:00Z" },
                                              headers: auth_headers_for(manager)

    rows = CSV.parse(response.body.delete_prefix(ExportService::BYTE_ORDER_MARK), headers: true)
    expect(rows.headers).to eq(%w[asset tag location availability downtime_hours failures mtbf_hours mttr_hours])
    expect(rows.pluck("asset")).to eq(["Pump", "'=Press"])
    expect(rows.first["availability"]).to eq("90.0")
  end

  it "has no PDF" do
    get "/api/v1/reports/assets/downtime.pdf", headers: auth_headers_for(manager)

    expect(response).to have_http_status(:not_acceptable)
  end

  it "is for managers" do
    get "/api/v1/reports/assets/downtime", headers: auth_headers_for(technician)

    expect(response).to have_http_status(:forbidden)
  end

  it "does not show another company's assets" do
    other = create(:asset, name: "Theirs", created_at: now - 60.days)
    create(:asset_downtime, organization: other.organization, asset: other)

    expect(get_json["assets"].pluck("name")).not_to include("Theirs")
  end
end
