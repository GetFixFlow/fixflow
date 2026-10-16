require "rails_helper"

# The figures on the IoT Monitor screen.
RSpec.describe "IoT dashboard", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:pump)       { create(:asset, organization: org, name: "Pump 3", location: create(:location, organization: org)) }
  let(:fan)        { create(:asset, organization: org, name: "Fan 1") }

  def reading(asset, value, at: Time.current, metric: "temperature", unit: "°C")
    create(:sensor_reading, asset: asset, organization: org, metric_name: metric, value: value, unit: unit, recorded_at: at)
  end

  def dashboard(as: manager)
    get "/api/v1/reports/iot/dashboard", headers: auth_headers_for(as)
    json_body
  end

  describe "an empty company" do
    it "shows zeros and empty lists, not an error" do
      expect(dashboard).to include(
        "active_sensors" => 0, "monitored_assets" => 0, "readings_per_hour" => 0, "readings_per_hour_change" => 0,
        "open_alerts" => 0, "critical_alerts" => 0, "active_rules" => 0, "triggered_rules" => 0,
        "recent_alerts" => [], "asset_status" => []
      )
      expect(json_body["hourly_readings"].size).to eq(168)
      expect(json_body["hourly_readings"].sum { |hour| hour["count"] }).to eq(0)
    end
  end

  describe "readings" do
    before do
      reading(pump, 70, at: 10.minutes.ago)
      reading(pump, 71, at: 30.minutes.ago)
      reading(pump, 3.2, at: 5.minutes.ago, metric: "vibration", unit: "mm/s")
      reading(fan, 40, at: 20.minutes.ago)
      reading(fan, 39, at: 90.minutes.ago)
      reading(fan, 38, at: 100.minutes.ago)
      reading(fan, 37, at: 110.minutes.ago)
      reading(pump, 66, at: 3.days.ago)
      create(:sensor_reading, asset: create(:asset, organization: create(:organization)), value: 1)
    end

    it "counts this hour's readings and compares them with the hour before" do
      body = dashboard

      expect(body["readings_per_hour"]).to eq(4)
      expect(body["readings_per_hour_change"]).to eq(33) # 4 now against 3 in the hour before
    end

    it "counts the sensors that have reported lately: one for each metric on each asset" do
      org.update!(settings: { "iot_stale_threshold" => 3600 })

      expect(dashboard["active_sensors"]).to eq(3) # pump temperature, pump vibration, fan temperature
    end

    it "counts only what reported within the company's stale limit (5 minutes unless it says otherwise)" do
      expect(dashboard["active_sensors"]).to eq(0) # the newest of them is 5 minutes old
    end

    it "counts the assets that reported in the last 24 hours" do
      expect(dashboard["monitored_assets"]).to eq(2)
    end

    it "stops counting a sensor as active once it has been silent longer than the company's stale limit" do
      org.update!(settings: { "iot_stale_threshold" => 15 * 60 })

      expect(dashboard["active_sensors"]).to eq(2) # the fan's last reading is 20 minutes old
    end

    it "never counts another company's readings" do
      expect(dashboard["monitored_assets"]).to eq(2)
      expect(dashboard["readings_per_hour"]).to eq(4)
    end

    it "gives 0 for the change when there were no readings in the hour before" do
      SensorReading.where(recorded_at: 2.hours.ago..90.minutes.ago).delete_all
      SensorReading.where(recorded_at: 100.minutes.ago..61.minutes.ago).delete_all

      expect(dashboard["readings_per_hour_change"]).to eq(0)
    end
  end

  describe "hourly readings" do
    it "has a point for each of the last 168 hours, with the readings and the alerts of that hour" do
      reading(pump, 70, at: 30.minutes.ago)
      reading(pump, 71, at: 40.minutes.ago)
      reading(pump, 72, at: 5.hours.ago)
      rule = create(:iot_rule, asset: pump, organization: org)
      create(:iot_alert, iot_rule: rule, asset: pump, sensor_reading: reading(pump, 99, at: 30.minutes.ago), created_at: 30.minutes.ago)

      points = dashboard["hourly_readings"]

      expect(points.size).to eq(168)
      expect(points.pluck("hour").uniq.size).to eq(168)
      expect(points.sum { |p| p["count"] }).to eq(4)
      expect(points.sum { |p| p["alerts"] }).to eq(1)
      expect(points.last(2).sum { |p| p["count"] }).to be >= 3 # this hour and the one before: 30 and 40 minutes ago
    end

    it "leaves out readings older than a week" do
      reading(pump, 1, at: 8.days.ago)

      expect(dashboard["hourly_readings"].sum { |p| p["count"] }).to eq(0)
    end
  end

  describe "alerts and rules" do
    let(:critical_rule) { create(:iot_rule, asset: pump, organization: org, wo_priority: :critical) }
    let(:high_rule)     { create(:iot_rule, asset: pump, organization: org, wo_priority: :high, metric_name: "vibration") }
    let(:medium_rule)   { create(:iot_rule, asset: fan, organization: org, wo_priority: :medium) }

    def alert_for(rule, **attrs)
      create(:iot_alert, { iot_rule: rule, asset: rule.asset, sensor_reading: reading(rule.asset, 99) }.merge(attrs))
    end

    it "counts the open alerts by severity, and none that are resolved or suppressed" do
      2.times { alert_for(critical_rule) }
      alert_for(high_rule)
      alert_for(medium_rule)
      alert_for(critical_rule, status: :resolved, resolved_at: 1.hour.ago)
      alert_for(critical_rule, status: :suppressed)
      alert_for(critical_rule, status: :acknowledged, acknowledged_at: 1.hour.ago)

      expect(dashboard).to include("open_alerts" => 4, "critical_alerts" => 2, "high_alerts" => 1, "medium_alerts" => 1)
    end

    it "does not count another company's alerts" do
      other_org = create(:organization)
      other_asset = create(:asset, organization: other_org)
      other_rule = create(:iot_rule, asset: other_asset, organization: other_org, wo_priority: :critical)
      create(:iot_alert, iot_rule: other_rule, asset: other_asset,
                         sensor_reading: create(:sensor_reading, asset: other_asset, organization: other_org))

      expect(dashboard).to include("open_alerts" => 0, "critical_alerts" => 0)
      expect(json_body["recent_alerts"]).to eq([])
    end

    it "counts the rules that are switched on, and those that set something off today" do
      critical_rule.update!(last_triggered_at: 1.hour.ago)
      high_rule.update!(last_triggered_at: 3.days.ago)
      create(:iot_rule, :paused, asset: pump, organization: org)
      create(:iot_rule, :archived, asset: pump, organization: org)

      expect(dashboard).to include("active_rules" => 2, "triggered_rules" => 1)
    end

    it "lists the newest alerts in the same shape as the alert list, at most 10" do
      12.times { |n| alert_for(critical_rule, created_at: (n + 1).hours.ago) }

      alerts = dashboard["recent_alerts"]

      expect(alerts.size).to eq(10)
      expect(alerts.first).to include("severity" => "critical", "rule_name" => critical_rule.name,
"message" => a_string_including("temperature"))
      expect(alerts.pluck("created_at")).to eq(alerts.pluck("created_at").sort.reverse)
    end
  end

  describe "asset status" do
    let!(:rule) { create(:iot_rule, asset: pump, organization: org, threshold: 85, operator: :gt) }

    it "shows each asset's metrics with the latest value, whether it is past its limit, and how close it is" do
      reading(pump, 70.5, at: 2.minutes.ago)
      reading(pump, 3.2, at: 2.minutes.ago, metric: "vibration", unit: "mm/s")

      status = dashboard["asset_status"].first

      expect(status).to include("asset_id" => pump.id, "asset_name" => "Pump 3", "asset_tag" => pump.asset_tag)
      temperature = status["metrics"].find { |m| m["metric_name"] == "temperature" }
      expect(temperature).to include("latest_value" => 70.5, "metric_unit" => "°C", "is_breached" => false, "is_stale" => false,
                                     "threshold" => 85.0, "threshold_operator" => "gt", "rule_id" => rule.id, "pct_of_threshold" => 83)
      vibration = status["metrics"].find { |m| m["metric_name"] == "vibration" }
      expect(vibration).to include("latest_value" => 3.2, "threshold" => nil, "rule_id" => nil, "pct_of_threshold" => nil,
"is_breached" => false)
    end

    it "uses the newest reading of a metric, not an older one" do
      reading(pump, 99, at: 3.hours.ago)
      reading(pump, 60, at: 1.minute.ago)

      metric = dashboard["asset_status"].first["metrics"].first

      expect(metric).to include("latest_value" => 60.0, "is_breached" => false)
    end

    it "marks a metric past its limit, and an asset with one comes first" do
      reading(fan, 10)
      reading(pump, 91)

      statuses = dashboard["asset_status"]

      expect(statuses.pluck("asset_name")).to eq(["Pump 3", "Fan 1"])
      expect(statuses.first["metrics"].first).to include("is_breached" => true, "latest_value" => 91.0, "pct_of_threshold" => 107)
    end

    it "marks a sensor that has gone quiet as stale" do
      reading(pump, 70, at: 30.minutes.ago)

      expect(dashboard["asset_status"].first["metrics"].first["is_stale"]).to be(true)
    end

    it "works out how close a reading is to a limit it must stay above" do
      low = create(:iot_rule, asset: fan, organization: org, operator: :lt, threshold: 20, metric_name: "pressure")
      reading(fan, 25, metric: "pressure", unit: "bar")

      metric = dashboard["asset_status"].find { |a| a["asset_id"] == fan.id }["metrics"].first

      expect(metric).to include("rule_id" => low.id, "pct_of_threshold" => 80, "is_breached" => false)
    end

    it "leaves out an asset that has been removed, and one with no recent readings" do
      removed = create(:asset, organization: org, name: "Old press", discarded_at: 1.day.ago)
      reading(removed, 1)
      reading(fan, 1, at: 3.days.ago)

      expect(dashboard["asset_status"]).to eq([])
    end

    it "shows at most 24 assets" do
      26.times { |n| reading(create(:asset, organization: org, name: "Asset #{n}"), 1) }

      expect(dashboard["asset_status"].size).to eq(24)
    end
  end

  describe "who may see it" do
    it "is open to a technician (the screen is for everyone who works with the equipment)" do
      reading(pump, 70)

      dashboard(as: technician)

      expect(response).to have_http_status(:ok)
      expect(json_body["monitored_assets"]).to eq(1)
    end

    it "needs a sign-in" do
      get "/api/v1/reports/iot/dashboard"

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
