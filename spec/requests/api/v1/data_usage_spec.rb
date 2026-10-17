require "rails_helper"

RSpec.describe "GET /api/v1/data_usage", type: :request do
  let(:org)     { create(:organization, settings: { "iot_data_retention_days" => 30, "audit_log_retention_days" => 365 }) }
  let!(:admin)  { create(:user, :admin, organization: org) }
  let(:pump)    { create(:asset, organization: org) }
  let(:now)     { Time.utc(2026, 10, 18, 12, 0) }

  def usage(as: admin)
    get "/api/v1/data_usage", headers: auth_headers_for(as)
    expect(response).to have_http_status(:ok)
    response.parsed_body
  end

  around { |example| travel_to(now) { example.run } }

  it "is for administrators only, and never stored by a browser" do
    [create(:user, :manager, organization: org), create(:user, organization: org),
     create(:user, :requester, organization: org)].each do |person|
      get "/api/v1/data_usage", headers: auth_headers_for(person)
      expect(response).to have_http_status(:forbidden)
    end
    get "/api/v1/data_usage"
    expect(response).to have_http_status(:unauthorized)
    usage
    expect(response.headers["Cache-Control"]).to include("no-store")
  end

  it "says how big the database is and how big and how full each big table is" do
    create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 1.day)
    body = usage
    expect(body["database_bytes"]).to be_a(Integer).and be_positive
    expect(body["tables"].keys).to eq(%w[sensor_readings sensor_aggregates activity_logs iot_alerts work_orders])
    expect(body["tables"].values).to all(include("bytes" => a_kind_of(Integer), "rows" => a_kind_of(Integer)))
    expect(body["tables"]["activity_logs"]["rows"]).to be_positive
  end

  it "counts the files people uploaded" do
    wo = create(:work_order, organization: org, asset: pump)
    wo.photos.attach(io: StringIO.new("x" * 100), filename: "leak.jpg", content_type: "image/jpeg") if wo.respond_to?(:photos)
    attached = ActiveStorage::Blob.count
    body = usage
    expect(body["attachments"]).to eq("count" => attached, "bytes" => ActiveStorage::Blob.sum(:byte_size))
  end

  it "says what is past the limit and will be removed tonight, and what is not" do
    rule = create(:iot_rule, organization: org, asset: pump)
    create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 40.days)
    create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 41.days)
    create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 2.days)
    evidence = create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 99.days)
    create(:iot_alert, iot_rule: rule, asset: pump, sensor_reading: evidence)
    create(:sensor_aggregate, asset: pump, period_start: now - 50.days)
    create(:activity_log, organization: org, created_at: now - 400.days)
    body = usage
    expect(body["sensor_data"]).to include("retention_days" => 30, "removable_readings" => 2, "removable_summaries" => 1)
    expect(body["audit_log"]).to include("retention_days" => 365, "removable_lines" => 1)
    expect(Time.zone.parse(body["sensor_data"]["oldest_at"])).to eq(now - 99.days)
  end

  it "says the audit log is kept for ever (null), with nothing to remove, when no limit is set" do
    org.assign_company_settings("audit_log_retention_days" => 0)
    org.save!
    create(:activity_log, organization: org, created_at: now - 4000.days)
    expect(usage["audit_log"]).to include("retention_days" => nil, "removable_lines" => 0)
  end

  it "follows the company's setting, so changing it changes what would be removed" do
    create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 10.days)
    expect(usage["sensor_data"]["removable_readings"]).to eq(0)
    org.assign_company_settings("iot_data_retention_days" => 7)
    org.save!
    expect(usage["sensor_data"]).to include("retention_days" => 7, "removable_readings" => 1)
  end

  it "leaves out a count that took too long (null) instead of holding the page up" do
    allow_any_instance_of(Retention).to receive(:old_readings).and_raise(ActiveRecord::QueryCanceled) # rubocop:disable RSpec/AnyInstance
    expect(usage["sensor_data"]).to include("removable_readings" => nil, "removable_summaries" => 0)
  end

  it "shows the limit the company's settings show, also for a company that never chose one" do
    stub_const("ENV", ENV.to_h.merge("IOT_RETENTION_DAYS" => "90"))
    org.update!(settings: {})
    get "/api/v1/organization_settings", headers: auth_headers_for(admin)
    shown = response.parsed_body.dig("organization", "iot_data_retention_days")
    expect(shown).to eq(90)
    expect(usage["sensor_data"]).to include("retention_days" => shown, "checked_days" => shown)
  end

  it "says what would be removed if the limits were different, without changing anything" do
    create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 10.days)
    create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 100.days)
    create(:activity_log, organization: org, created_at: now - 400.days)
    create(:activity_log, organization: org, created_at: now - 40.days)
    get "/api/v1/data_usage", params: { sensor_days: 7, audit_days: 30 }, headers: auth_headers_for(admin)
    body = response.parsed_body
    expect(body["sensor_data"]).to include("retention_days" => 30, "checked_days" => 7, "removable_readings" => 2)
    expect(body["audit_log"]).to include("retention_days" => 365, "checked_days" => 30, "removable_lines" => 2)
    expect(org.reload.settings_with_defaults).to include("iot_data_retention_days" => 30, "audit_log_retention_days" => 365)
    expect(SensorReading.unscoped.where(organization_id: org.id).count).to eq(2)
  end

  it "can ask about keeping the audit log for ever (0), and ignores limits that are not sensible" do
    create(:activity_log, organization: org, created_at: now - 4000.days)
    get "/api/v1/data_usage", params: { audit_days: 0 }, headers: auth_headers_for(admin)
    expect(response.parsed_body["audit_log"]).to include("checked_days" => nil, "removable_lines" => 0)
    ["-5", "abc", "99999", "1.5", ""].each do |bad|
      get "/api/v1/data_usage", params: { sensor_days: bad, audit_days: bad }, headers: auth_headers_for(admin)
      expect(response.parsed_body.values_at("sensor_data", "audit_log").pluck("checked_days")).to eq([30, 365]), bad
    end
  end

  it "says when each nightly cleanup runs" do
    expect(usage["cleanup_at"]).to eq("sensor_data" => "02:00 UTC", "audit_log" => "02:30 UTC")
  end

  it "tells the truth about backups: a nightly time, how long they are kept, and whether this server makes them" do
    expect(usage["backups"]).to eq("runs" => false, "at" => "03:00 UTC", "keep_days" => 30, "bucket" => "fixflow-backups")
  end
end
