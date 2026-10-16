require "rails_helper"

# What the report screens read, pinned from both ends. Each response below is compared, field by field and type by
# type, with a JSON file in apps/web/src/test/fixtures/reports. The web app's tests load the same files into the
# types the screens use (apps/web/src/types/reports.ts), so a field renamed here fails there and the other way round.
#
# Ids and tags differ from run to run, so only shapes are compared, never values.
#
# After changing a report on purpose, regenerate the files and commit them with the web change:
#   UPDATE_REPORT_FIXTURES=1 bundle exec rspec spec/contracts/report_shapes_spec.rb
RSpec.describe "Report response shapes", type: :request do
  def fixture_dir = Rails.root.join("apps/web/src/test/fixtures/reports")

  # Only the kinds of value and the names of fields: "string", "number", "boolean", "null", and the shapes inside
  # lists (each different kind of row once). Numbers are numbers whether whole or not.
  def shape_of(value)
    case value
    when Hash then value.transform_values { |inner| shape_of(inner) }
    when Array then value.map { |inner| shape_of(inner) }.uniq.sort_by(&:to_s)
    when String then "string"
    when Numeric then "number"
    when true, false then "boolean"
    else "null"
    end
  end

  def empty_lists(value, path = "")
    case value
    when Hash then value.flat_map { |key, inner| empty_lists(inner, "#{path}/#{key}") }
    when Array then value.empty? ? [path] : value.flat_map { |inner| empty_lists(inner, "#{path}[]") }
    else []
    end
  end

  def expect_fixture(name, body)
    file = fixture_dir.join("#{name}.json")
    if ENV["UPDATE_REPORT_FIXTURES"]
      FileUtils.mkdir_p(fixture_dir)
      file.write("#{JSON.pretty_generate(body)}\n")
    end
    expect(file).to exist, "#{file} is missing: run with UPDATE_REPORT_FIXTURES=1"
    expect(shape_of(body)).to eq(shape_of(JSON.parse(file.read))),
                              "#{name}: the response no longer has the shape the web app was written for"
    expect(empty_lists(body)).to eq([]), "#{name}: the data below leaves a list empty, which would prove nothing about its rows"
  end

  let(:org)     { create(:organization) }
  let(:manager) { create(:user, :manager, organization: org) }
  let(:alice)   { create(:user, organization: org, first_name: "Alice", last_name: "Silva") }
  let(:bob)     { create(:user, organization: org, first_name: "Bob", last_name: "Perera") }
  let(:plant)   { create(:location, organization: org, name: "Plant 1") }
  let(:pump)    { create(:asset, organization: org, name: "Pump", location: plant, status: "operational") }
  let(:press)   { create(:asset, organization: org, name: "Press", location: plant, status: "down") }
  let(:fan)     { create(:asset, organization: org, name: "Fan", status: "degraded") }
  let(:now)     { Time.utc(2026, 10, 16, 12, 0) }
  let(:period)  { { from: "2026-09-16", to: "2026-10-16" } }

  def make(asset, **attrs)
    notes = %w[completed verified].include?(attrs[:status]) ? { completion_notes: "Done" } : {}
    create(:work_order, organization: org, asset: asset, title: "Job on #{asset.name}", description: "Details", **notes, **attrs)
  end

  def fetch(path, **params)
    get "/api/v1/#{path}", params: params, headers: auth_headers_for(manager)
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  around { |example| travel_to(now) { example.run } }

  before do
    schedule = create(:preventive_maintenance, organization: org, asset: pump)
    make(pump, priority: "high", status: "completed", assignee: alice, created_at: now - 6.days, started_at: now - 5.days - 4.hours,
               completed_at: now - 5.days, due_date: now - 5.days - 2.hours, labor_cost: 100, parts_cost: 20.5)
    make(pump, priority: "critical", status: "verified", assignee: bob, created_at: now - 5.days, started_at: now - 5.days + 1.hour,
               completed_at: now - 5.days + 3.hours, due_date: now + 1.day, labor_cost: 50, parts_cost: 10,
               preventive_maintenance: schedule)
    make(press, priority: "high", status: "open", assignee: alice, created_at: now - 3.days, due_date: now - 1.day)
    make(press, priority: "low", status: "assigned", assignee: bob, created_at: now - 20.days)
    make(fan, priority: "medium", status: "in_progress", assignee: alice, created_at: now - 40.days, started_at: now - 2.hours)
    make(fan, priority: "medium", status: "completed", assignee: alice, created_at: now - 22.days, started_at: now - 21.days,
              completed_at: now - 20.days, labor_cost: 30, parts_cost: 5)
    make(fan, priority: "low", status: "cancelled", cancellation_reason: "Duplicate", created_at: now - 4.days)
    rule = create(:iot_rule, organization: org, asset: pump)
    create(:iot_alert, iot_rule: rule, asset: pump, created_at: now - 2.days)
  end

  it "work_orders_summary" do
    expect_fixture("work_orders_summary", fetch("reports/work_orders/summary", **period))
  end

  it "work_orders_mttr" do
    expect_fixture("work_orders_mttr", fetch("reports/work_orders/mttr", **period))
  end

  it "work_orders_backlog" do
    expect_fixture("work_orders_backlog", fetch("reports/work_orders/backlog"))
  end

  it "technician_performance" do
    expect_fixture("technician_performance", fetch("reports/work_orders/technician_performance", **period))
  end

  it "assets_health" do
    expect_fixture("assets_health", fetch("reports/assets/health"))
  end

  it "assets_history" do
    expect_fixture("assets_history", fetch("reports/assets/#{pump.id}/history"))
  end

  it "costs_summary" do
    expect_fixture("costs_summary", fetch("reports/costs/summary", **period))
  end

  it "costs_by_asset" do
    expect_fixture("costs_by_asset", fetch("reports/costs/by_asset", **period))
  end
end
