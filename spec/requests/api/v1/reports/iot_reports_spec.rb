require "rails_helper"

# The IoT analytics report: its figures, the rule table, the CSV, and the existing alert summary.
RSpec.describe "IoT reports", type: :request do
  let(:org)        { create(:organization) }
  let(:manager)    { create(:user, :manager, organization: org) }
  let(:technician) { create(:user, organization: org) }
  let(:plant)      { create(:location, organization: org, name: "Plant") }
  let(:annex)      { create(:location, organization: org, name: "Annex") }
  let(:pump)       { create(:asset, organization: org, name: "Pump 3", location: plant) }
  let(:fan)        { create(:asset, organization: org, name: "Fan 1", location: annex) }
  let(:hot)        { create(:iot_rule, asset: pump, organization: org, name: "Pump too hot", wo_priority: :critical, unit: "°C") }
  let(:warm)       { create(:iot_rule, asset: pump, organization: org, name: "Pump warm", wo_priority: :medium) }
  let(:fan_rule)   { create(:iot_rule, asset: fan, organization: org, name: "Fan hot", wo_priority: :high) }

  def period(from: 10.days.ago, to: Time.current) = { from: from.to_date.iso8601, to: to.to_date.iso8601 }

  def alert(rule, created: 2.days.ago, **attrs)
    reading = create(:sensor_reading, asset: rule.asset, organization: org, value: 95, recorded_at: created)
    create(:iot_alert, { iot_rule: rule, asset: rule.asset, sensor_reading: reading, created_at: created }.merge(attrs))
  end

  def report(path, as: manager, **params)
    get "/api/v1/reports/iot/#{path}", params: period.merge(params), headers: auth_headers_for(as)
    json_body
  end

  describe "GET /reports/iot/alerts" do
    before do
      alert(hot, created: 3.days.ago)
      alert(hot, created: 3.days.ago, status: :resolved, resolved_at: 2.days.ago, work_order: create(:work_order, organization: org))
      alert(warm, created: 2.days.ago, status: :resolved, resolved_at: 1.day.ago)
      alert(fan_rule, created: 1.day.ago)
      alert(hot, created: 30.days.ago)
      other_org = create(:organization)
      other_asset = create(:asset, organization: other_org)
      create(:iot_alert, iot_rule: create(:iot_rule, asset: other_asset, organization: other_org), asset: other_asset,
                         sensor_reading: create(:sensor_reading, asset: other_asset, organization: other_org))
    end

    it "counts the alerts of the period: all, critical, still open, with a work order, and the share resolved" do
      body = report("alerts")

      expect(body).to include("total_alerts" => 4, "critical_count" => 2, "open_count" => 2, "work_orders_created" => 1,
"resolved_rate" => 50.0)
    end

    it "has a point for each day, zeros included, with the alerts of each severity and those since resolved" do
      trend = report("alerts")["trend"]

      expect(trend.size).to eq(11)
      expect(trend.pluck("period")).to eq(trend.pluck("period").sort)
      expect(trend.sum { |day| day["critical"] }).to eq(2)
      expect(trend.sum { |day| day["medium"] }).to eq(1)
      expect(trend.sum { |day| day["high"] }).to eq(1)
      expect(trend.sum { |day| day["resolved"] }).to eq(2)
      busiest = trend.find { |day| day["critical"] == 2 }
      expect(busiest).to include("period" => 3.days.ago.to_date.iso8601, "resolved" => 1)
      expect(trend.count { |day| day.slice("critical", "high", "medium", "low").values.sum.zero? }).to eq(8)
    end

    it "shows a longer period by the week, so a chart never has thousands of points" do
      trend = report("alerts", from: 200.days.ago.to_date.iso8601)["trend"]

      expect(trend.size).to be < 40
      expect(trend.map { |week| Date.parse(week["period"]).wday }.uniq).to eq([1]) # every week starts on a Monday
      expect(trend.sum { |week| week["critical"] }).to eq(3)
    end

    it "holds only the period asked for" do
      expect(report("alerts", from: 200.days.ago.to_date.iso8601)["total_alerts"]).to eq(5)
    end

    it "includes the whole of the last day when only a date is given" do
      alert(hot, created: Time.zone.now.beginning_of_day + 1.minute)
      today = Time.zone.today.iso8601

      get "/api/v1/reports/iot/alerts", params: { from: today, to: today }, headers: auth_headers_for(manager)

      expect(json_body["total_alerts"]).to eq(1)
    end

    it "follows the Filters panel: assets, places and severities" do
      expect(report("alerts", "asset_ids" => [fan.id])["total_alerts"]).to eq(1)
      expect(report("alerts", "location_ids" => [plant.id])["total_alerts"]).to eq(3)
      expect(report("alerts", "priorities" => ["critical"])["total_alerts"]).to eq(2)
      expect(report("alerts", "priorities" => ["critical"], "asset_ids" => [fan.id])["total_alerts"]).to eq(0)
    end

    it "never counts another company's alerts" do
      expect(report("alerts", from: 365.days.ago.to_date.iso8601)["total_alerts"]).to eq(5)
    end

    it "is all zeros, not an error, for a company with no alerts" do
      IotAlert.delete_all

      expect(report("alerts")).to include("total_alerts" => 0, "critical_count" => 0, "resolved_rate" => 0, "sensor_series" => [])
    end

    it "is for managers" do
      report("alerts", as: technician)

      expect(response).to have_http_status(:forbidden)
    end

    it "needs a sign-in" do
      get "/api/v1/reports/iot/alerts", params: period

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "the sensor comparison" do
    it "is given for exactly one asset, as a daily average of each of its metrics" do
      [[3.days.ago, 70], [3.days.ago, 80], [2.days.ago, 60]].each do |at, value|
        create(:sensor_reading, asset: pump, organization: org, metric_name: "temperature", value: value, unit: "°C", recorded_at: at)
      end
      create(:sensor_reading, asset: pump, organization: org, metric_name: "vibration", value: 3, unit: "mm/s", recorded_at: 2.days.ago)

      series = report("alerts", "asset_ids" => [pump.id])["sensor_series"]

      temperature = series.find { |s| s["metric"] == "temperature" }
      expect(temperature).to include("unit" => "°C")
      expect(temperature["data"]).to eq([{ "time" => 3.days.ago.to_date.iso8601, "value" => 75.0 },
                                         { "time" => 2.days.ago.to_date.iso8601, "value" => 60.0 }])
      expect(series.pluck("metric")).to contain_exactly("temperature", "vibration")
    end

    it "is empty when no asset, or more than one, is chosen" do
      create(:sensor_reading, asset: pump, organization: org, recorded_at: 2.days.ago)

      expect(report("alerts")["sensor_series"]).to eq([])
      expect(report("alerts", "asset_ids" => [pump.id, fan.id])["sensor_series"]).to eq([])
    end
  end

  describe "GET /reports/iot/rule_effectiveness" do
    before do
      alert(hot, created: 3.days.ago, status: :resolved, resolved_at: 3.days.ago + 2.hours,
work_order: create(:work_order, organization: org))
      alert(hot, created: 2.days.ago, status: :resolved, resolved_at: 2.days.ago + 4.hours)
      alert(hot, created: 1.day.ago)
      alert(hot, created: 1.day.ago)
      alert(warm, created: 1.day.ago)
      create(:iot_rule, :paused, asset: pump, organization: org, name: "Switched off")
    end

    it "gives each rule's alerts, work orders, the share resolved and how long that took" do
      body = report("rule_effectiveness")

      row = body["rules"].find { |r| r["rule_name"] == "Pump too hot" }
      expect(row).to include("trigger_count" => 4, "wo_created" => 1, "resolve_rate" => 50.0, "avg_resolution_hours" => 3.0,
                             "asset_name" => "Pump 3", "rule_id" => hot.id)
      expect(body["rules"].find { |r|
        r["rule_name"] == "Pump warm"
      }).to include("trigger_count" => 1, "resolve_rate" => 0, "avg_resolution_hours" => 0.0)
    end

    it "lists a rule with no alerts if it is switched on, and counts the active rules" do
      rules = report("rule_effectiveness")

      expect(rules["active_count"]).to eq(2)
      names = rules["rules"].pluck("rule_name")
      expect(names).not_to include("Switched off")
      fan_rule
      expect(report("rule_effectiveness")["rules"].find { |r|
        r["rule_name"] == "Fan hot"
      }).to include("trigger_count" => 0, "avg_resolution_hours" => 0.0)
    end

    it "has a number for every figure, so the table can always show it" do
      row = report("rule_effectiveness")["rules"].first

      expect(row.values_at("trigger_count", "wo_created", "resolve_rate", "avg_resolution_hours")).to all(be_a(Numeric))
    end

    it "is for managers, and never shows another company's rules" do
      other_org = create(:organization)
      create(:iot_rule, asset: create(:asset, organization: other_org), organization: other_org, name: "Someone else's rule")

      expect(report("rule_effectiveness")["rules"].pluck("rule_name")).not_to include("Someone else's rule")
      report("rule_effectiveness", as: technician)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "the CSV of alerts" do
    def csv_rows = CSV.parse(response.body.delete_prefix("\uFEFF"), headers: true)

    it "lists the alerts of the period, newest first, with the rule, asset, place and readings" do
      alert(hot, created: 3.days.ago, status: :resolved, resolved_at: 2.days.ago)
      alert(fan_rule, created: 1.day.ago)
      alert(hot, created: 30.days.ago)

      get "/api/v1/reports/iot/alerts.csv", params: period, headers: auth_headers_for(manager)

      expect(response.content_type).to include("text/csv")
      expect(response.headers["Content-Disposition"]).to include("iot_alerts_#{Time.zone.today}.csv")
      expect(csv_rows.headers).to start_with(%w[raised_at asset location rule severity status])
      expect(csv_rows.pluck("rule")).to eq(["Fan hot", "Pump too hot"])
      expect(csv_rows.first.to_h).to include("asset" => "Fan 1", "location" => "Annex", "severity" => "high", "status" => "open",
                                              "reading" => "95.0", "threshold" => "85.0")
      expect(csv_rows.by_row[1].to_h).to include("severity" => "critical", "status" => "resolved", "unit" => "°C")
    end

    it "follows the filters, as the screen does" do
      alert(hot)
      alert(fan_rule)

      get "/api/v1/reports/iot/alerts.csv", params: period.merge("priorities" => ["high"]), headers: auth_headers_for(manager)

      expect(csv_rows.pluck("rule")).to eq(["Fan hot"])
    end

    it "keeps text a spreadsheet would run as a formula as plain text (anyone can name an asset or a rule)" do
      evil_asset = create(:asset, organization: org, name: "=HYPERLINK(\"http://evil.example\",\"x\")")
      evil = create(:iot_rule, asset: evil_asset, organization: org, name: "+cmd|' /C calc'!A0")
      alert(evil)

      get "/api/v1/reports/iot/alerts.csv", params: period, headers: auth_headers_for(manager)

      expect(csv_rows.first["asset"]).to start_with("'=HYPERLINK")
      expect(csv_rows.first["rule"]).to start_with("'+cmd")
    end

    it "says when the file is cut short" do
      stub_const("Api::V1::Reports::BaseController::MAX_EXPORT_ROWS", 1)
      alert(hot)
      alert(hot)

      get "/api/v1/reports/iot/alerts.csv", params: period, headers: auth_headers_for(manager)

      expect(response.headers["X-Export-Truncated"]).to eq("true")
      expect(csv_rows.size).to eq(1)
    end

    it "has no PDF, and is for managers" do
      get "/api/v1/reports/iot/alerts.pdf", params: period, headers: auth_headers_for(manager)
      expect(response).to have_http_status(:not_acceptable)

      get "/api/v1/reports/iot/alerts.csv", params: period, headers: auth_headers_for(technician)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /reports/iot/alert_summary" do
    it "counts the resolved alerts (it compared a status number with the name the database gives, and counted none)" do
      alert(hot, status: :resolved, resolved_at: 1.day.ago)
      alert(hot, status: :resolved, resolved_at: 1.day.ago)
      alert(hot)

      body = report("alert_summary")

      expect(body["resolved"]).to eq(2)
      expect(body["by_asset"].first).to include("asset_name" => "Pump 3", "resolved" => 2, "total" => 3, "resolved_rate" => 66.7)
      expect(body["trend"].sum { |day| day["resolved"] }).to eq(2)
    end
  end
end
