require "rails_helper"
require "sidekiq/api"

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

  def fetch(path, as: manager, **params)
    get "/api/v1/#{path}", params: params, headers: auth_headers_for(as)
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  # Everything the health page looks at, set up and answering: mail, an MQTT broker, a worker, a newer release.
  def stub_working_install
    stub_const("ENV", ENV.to_h.merge("SMTP_HOST" => "smtp.acme.test", "MQTT_HOST" => "mqtt.acme.test", "APP_VERSION" => "0.1.0"))
    allow(EmailSetup).to receive(:source).and_return(:environment)
    allow(Socket).to receive(:tcp).and_call_original
    allow(Socket).to receive(:tcp).with("smtp.acme.test", any_args)
    allow(Socket).to receive(:tcp).with("mqtt.acme.test", any_args)
    allow(Iot::MqttStatus).to receive(:read).and_return({ connected: true, last_message_at: now - 5.minutes })
    allow(Sidekiq::ProcessSet).to receive(:new).and_return(instance_double(Sidekiq::ProcessSet, size: 1, sum: 0))
    stats = instance_double(Sidekiq::Stats, enqueued: 0, scheduled_size: 0, retry_size: 0, dead_size: 0)
    allow(Sidekiq::Stats).to receive(:new).and_return(stats)
    allow(Sidekiq::Queue).to receive(:all).and_return([instance_double(Sidekiq::Queue, latency: 0)])
    body = { tag_name: "v0.2.0", html_url: "https://github.com/GetFixFlow/fixflow/releases/tag/v0.2.0" }.to_json
    stub_request(:get, "https://api.github.com/repos/GetFixFlow/fixflow/releases/latest").to_return(status: 200, body: body)
  end

  around { |example| travel_to(now) { example.run } }

  # The company's data. Written without audit lines (every record would otherwise add one, made by "the system"),
  # so the activity feed holds only the line made on purpose below.
  def build_company
    manager
    acme = create(:vendor, organization: org, name: "Acme Electric")
    schedule = create(:preventive_maintenance, organization: org, asset: pump)
    make(pump, priority: "high", status: "completed", assignee: alice, created_at: now - 6.days, started_at: now - 5.days - 4.hours,
               completed_at: now - 5.days, due_date: now - 5.days - 2.hours, labor_cost: 100, parts_cost: 20.5,
               vendor: acme, vendor_cost: 300)
    make(pump, priority: "critical", status: "verified", assignee: bob, created_at: now - 5.days, started_at: now - 5.days + 1.hour,
               completed_at: now - 5.days + 3.hours, due_date: now + 1.day, labor_cost: 50, parts_cost: 10,
               preventive_maintenance: schedule)
    make(press, priority: "high", status: "open", assignee: alice, created_at: now - 3.days, due_date: now - 1.day)
    make(press, priority: "low", status: "assigned", assignee: bob, created_at: now - 20.days)
    make(fan, priority: "medium", status: "in_progress", assignee: alice, created_at: now - 40.days, started_at: now - 2.hours)
    make(fan, priority: "medium", status: "completed", assignee: alice, created_at: now - 22.days, started_at: now - 21.days,
              completed_at: now - 20.days, labor_cost: 30, parts_cost: 5)
    make(fan, priority: "low", status: "cancelled", cancellation_reason: "Duplicate", created_at: now - 4.days)
    build_alerts_and_schedules(schedule)
  end

  def build_alerts_and_schedules(schedule)
    rule = create(:iot_rule, organization: org, asset: pump)
    create(:iot_alert, iot_rule: rule, asset: pump, created_at: now - 2.days)
    create(:pm_execution, :completed, preventive_maintenance: schedule, scheduled_date: now.to_date - 3)
    create(:pm_execution, :skipped, preventive_maintenance: schedule, scheduled_date: now.to_date - 5)
    create(:pm_execution, :generated, preventive_maintenance: schedule, scheduled_date: now.to_date - 6)
    create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 1.day)
    create(:preventive_maintenance, organization: org, asset: pump, assigned_to: alice, next_due_at: now + 2.days)
    create(:activity_log, organization: org, user: alice, resource_name: "WO-1")
  end

  before { Auditable.silenced { build_company } }

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

  it "dashboard_full (managers and administrators)" do
    expect_fixture("dashboard_full", fetch("dashboard"))
  end

  it "dashboard_technician" do
    expect_fixture("dashboard_technician", fetch("dashboard", as: alice))
  end

  it "dashboard_requester" do
    customer = create(:user, :requester, organization: org)
    make(pump, status: "open", requester: customer)
    expect_fixture("dashboard_requester", fetch("dashboard", as: customer))
  end

  it "pm_compliance" do
    expect_fixture("pm_compliance", fetch("reports/pm/compliance", **period))
  end

  it "pm_forecast" do
    expect_fixture("pm_forecast", fetch("reports/pm/schedule_forecast", days: 30))
  end

  it "iot_alerts (with one asset chosen, so the sensor series is there)" do
    expect_fixture("iot_alerts", fetch("reports/iot/alerts", **period, "asset_ids" => [pump.id]))
  end

  it "iot_rule_effectiveness" do
    expect_fixture("iot_rule_effectiveness", fetch("reports/iot/rule_effectiveness", **period))
  end

  it "system_health (an install where everything is set up and working)" do
    admin = create(:user, :admin, organization: org)
    stub_working_install
    expect_fixture("system_health", fetch("system_health", as: admin))
  end

  it "activity_logs (the audit log: a line by a person, one by the system, and one with a role change)" do
    admin = create(:user, :admin, organization: org)
    Auditable.silenced do
      create(:activity_log, organization: org, user: alice, action: "asset.updated", resource_type: "Asset", resource_id: 7,
                            resource_name: "Pump", metadata: { "changed" => %w[name status] }, ip_address: "10.0.0.5")
      create(:activity_log, organization: org, user: nil, action: "work_order.created", resource_type: "WorkOrder", resource_id: 3,
                            resource_name: "WO-000003", metadata: {}, ip_address: nil)
      create(:activity_log, organization: org, user: alice, action: "user.updated", resource_type: "User", resource_id: 9,
                            resource_name: "Bo Technician",
                            metadata: { "changed" => ["role"], "values" => { "role" => %w[technician manager] } })
    end
    expect_fixture("activity_logs", fetch("activity_logs", as: admin))
  end

  it "data_usage (what the data takes up, and what the retention settings would remove)" do
    admin = create(:user, :admin, organization: org)
    org.assign_company_settings("iot_data_retention_days" => 30, "audit_log_retention_days" => 365)
    org.save!
    Auditable.silenced do
      create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 90.days)
      create(:sensor_aggregate, asset: pump, period_start: now - 90.days)
      create(:activity_log, organization: org, created_at: now - 500.days)
    end
    expect_fixture("data_usage", fetch("data_usage", as: admin))
  end

  it "backups (the database backups in the file storage)" do
    admin = create(:user, :admin, organization: org)
    client = Aws::S3::Client.new(stub_responses: true)
    client.stub_responses(:list_objects_v2, contents: [
      { key: "backups/fixflow_20261016_030000.sql.gz", last_modified: now - 1.day, size: 1_048_576 },
      { key: "backups/fixflow_20261015_030000.sql.gz", last_modified: now - 2.days, size: 1_000_000 }
    ])
    allow(BackupStore).to receive(:new).and_return(BackupStore.new(client: client))
    expect_fixture("backups", fetch("backups", as: admin))
  end

  it "costs_summary" do
    expect_fixture("costs_summary", fetch("reports/costs/summary", **period))
  end

  it "costs_by_asset" do
    expect_fixture("costs_by_asset", fetch("reports/costs/by_asset", **period))
  end

  it "costs_by_vendor" do
    expect_fixture("costs_by_vendor", fetch("reports/costs/by_vendor", **period))
  end
end
