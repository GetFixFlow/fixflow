require "rails_helper"

RSpec.describe ExportService, type: :service do
  def parse(csv) = CSV.parse(csv.delete_prefix(ExportService::BYTE_ORDER_MARK), headers: true)

  let(:organization) { create(:organization) }

  describe "every file" do
    it "starts with a byte order mark so Excel reads accents and non-Latin names correctly" do
      csv = described_class.pm_compliance_csv([{ month: "2026-04", scheduled: 1, completed: 1, skipped: 0, compliance_rate: 100.0 }])

      expect(csv).to start_with("﻿")
      expect(csv.encoding).to eq(Encoding::UTF_8)
    end

    it "keeps non-Latin text as it is" do
      csv = described_class.cost_by_location_csv([{ location_name: "ஆலை · Café", labor_cost: 1, parts_cost: 2, vendor_cost: 0,
                                                    total_cost: 3, wo_count: 1 }])

      expect(parse(csv).first["location"]).to eq("ஆலை · Café")
    end
  end

  describe "text a spreadsheet would run as a formula" do
    it "is written with a leading ' so it stays text, in every column that holds text" do
      work_order = create(:work_order, organization: organization, title: "=HYPERLINK(\"http://evil.example\",\"click\")",
                                       asset: create(:asset, organization: organization, name: "+cmd|' /C calc'!A0"))

      row = parse(described_class.work_orders_csv([work_order])).first

      expect(row["title"]).to start_with("'=HYPERLINK")
      expect(row["asset"]).to start_with("'+cmd")
    end

    %w[= + - @].each do |start|
      it "protects text starting with #{start}" do
        csv = described_class.technician_performance_csv([{ name: "#{start}1+1", assigned: 1, completed: 1 }])

        expect(parse(csv).first["name"]).to eq("'#{start}1+1")
      end
    end

    it "protects text starting with a tab or a carriage return" do
      expect(described_class.cell("\t=1+1")).to eq("'\t=1+1")
      expect(described_class.cell("\r=1+1")).to eq("'\r=1+1")
    end

    it "leaves ordinary text and numbers alone, including negative numbers and dates" do
      expect(described_class.cell("Pump A-1")).to eq("Pump A-1")
      expect(described_class.cell(-5.5)).to eq(-5.5)
      expect(described_class.cell(Date.new(2026, 10, 16))).to eq("2026-10-16")
      expect(described_class.cell(nil)).to be_nil
    end
  end

  describe ".work_orders_csv" do
    let(:tech) { create(:user, organization: organization, first_name: "Tina", last_name: "Tech") }
    let(:work_order) do
      create(:work_order, :completed, organization: organization, assignee: tech, labor_cost: 100, parts_cost: 50.5, vendor_cost: 200,
                                      asset: create(:asset, organization: organization, name: "Pump A"),
                                      vendor: create(:vendor, organization: organization, name: "Acme Electric"),
                                      due_date: Time.zone.local(2026, 5, 1, 9, 30), completed_at: Time.zone.local(2026, 5, 2, 17, 0))
    end

    it "writes each work order with its asset, assignee, costs and times" do
      rows = parse(described_class.work_orders_csv([work_order]))

      expect(rows.headers).to eq(%w[work_order_number title priority status asset assignee vendor due_date started_at
                                    completed_at labor_cost parts_cost vendor_cost total_cost created_at])
      expect(rows.first.to_h).to include("work_order_number" => work_order.work_order_number, "asset" => "Pump A",
                                         "assignee" => "Tina Tech", "vendor" => "Acme Electric", "labor_cost" => "100.0",
                                         "parts_cost" => "50.5", "vendor_cost" => "200.0", "total_cost" => "350.5",
                                         "due_date" => "2026-05-01 09:30",
                                         "completed_at" => "2026-05-02 17:00", "started_at" => nil)
    end

    it "copes with a work order that has no asset or assignee" do
      work_order = create(:work_order, organization: organization, asset: nil)

      row = parse(described_class.work_orders_csv([work_order])).first

      expect(row["asset"]).to be_nil
      expect(row["assignee"]).to be_nil
    end
  end

  describe ".asset_health_csv" do
    it "has a column for each figure the report shows, and a value in each" do
      rows = parse(described_class.asset_health_csv([
        { location: "Floor 1", total: 10, operational: 8, degraded: 1, down: 1, health_score: 90.0 }
      ]))

      expect(rows.headers).to eq(%w[location total operational degraded down health_score])
      expect(rows.first.to_h).to eq("location" => "Floor 1", "total" => "10", "operational" => "8", "degraded" => "1",
                                    "down" => "1", "health_score" => "90.0")
    end
  end

  describe ".pm_compliance_csv" do
    it "writes one row per month" do
      rows = parse(described_class.pm_compliance_csv([
        { month: "2026-04", scheduled: 10, completed: 8, skipped: 1, compliance_rate: 88.9 },
        { month: "2026-05", scheduled: 8, completed: 7, skipped: 0, compliance_rate: 100.0 }
      ]))

      expect(rows.headers).to eq(%w[month scheduled completed skipped compliance_rate])
      expect(rows.pluck("month")).to eq(%w[2026-04 2026-05])
      expect(rows.first["compliance_rate"]).to eq("88.9")
    end
  end

  describe ".technician_performance_csv" do
    it "writes each person's figures" do
      rows = parse(described_class.technician_performance_csv([
        { user_id: 1, name: "Tina", assigned: 5, completed: 4, completion_rate: 80.0, avg_resolution_hours: 2.5,
          on_time_rate: 75.0, first_time_fix_rate: 100.0, critical_completed: 1 }
      ]))

      expect(rows.first.to_h).to eq("name" => "Tina", "assigned" => "5", "completed" => "4", "completion_rate" => "80.0",
                                    "avg_resolution_hours" => "2.5", "on_time_rate" => "75.0",
                                    "first_time_fix_rate" => "100.0", "critical_completed" => "1")
    end
  end

  describe ".cost_by_asset_csv and .cost_by_location_csv" do
    it "write labor, parts, vendor, total and the number of work orders" do
      assets = parse(described_class.cost_by_asset_csv([
        { asset_id: 1, asset_name: "Pump", labor_cost: 150.0, parts_cost: 50.0, vendor_cost: 10.0, total_cost: 210.0, wo_count: 2 }
      ]))
      places = parse(described_class.cost_by_location_csv([
        { location_id: 1, location_name: "Plant > Floor 1", labor_cost: 1.5, parts_cost: 2.0, vendor_cost: 0.0, total_cost: 3.5,
          wo_count: 1 }
      ]))

      expect(assets.first.to_h).to eq("asset" => "Pump", "labor_cost" => "150.0", "parts_cost" => "50.0", "vendor_cost" => "10.0",
                                      "total_cost" => "210.0", "work_orders" => "2")
      expect(places.first.to_h).to eq("location" => "Plant > Floor 1", "labor_cost" => "1.5", "parts_cost" => "2.0",
                                      "vendor_cost" => "0.0", "total_cost" => "3.5", "work_orders" => "1")
    end

    it "writes what each vendor charged, and keeps a vendor name that looks like a formula as text" do
      vendors = parse(described_class.cost_by_vendor_csv([{ vendor_id: 1, vendor_name: "=SUM(A1)", vendor_cost: 750.0, wo_count: 2 }]))

      expect(vendors.first.to_h).to eq("vendor" => "'=SUM(A1)", "vendor_cost" => "750.0", "work_orders" => "2")
    end
  end

  describe ".iot_alerts_csv" do
    let(:plant)  { create(:location, organization: organization, name: "Plant") }
    let(:asset)  { create(:asset, organization: organization, name: "Pump 3", location: plant) }
    let(:rule)   {
      create(:iot_rule, asset: asset, organization: organization, name: "Pump too hot", wo_priority: :critical, unit: "°C")
    }
    let(:alert) do
      create(:iot_alert, iot_rule: rule, asset: asset, triggered_value: 91.5, created_at: Time.zone.local(2026, 10, 1, 9, 30),
                         sensor_reading: create(:sensor_reading, asset: asset, organization: organization),
                         work_order: create(:work_order, organization: organization))
    end

    it "has a column for each fact about the alert" do
      expect(parse(described_class.iot_alerts_csv([alert])).headers).to eq(
        %w[raised_at asset location rule severity status metric reading threshold unit acknowledged_at resolved_at work_order]
      )
    end

    it "writes the alert with its asset, place, rule, severity, readings and times" do
      row = parse(described_class.iot_alerts_csv([alert])).first.to_h

      expect(row).to include("raised_at" => "2026-10-01 09:30", "asset" => "Pump 3", "location" => "Plant", "rule" => "Pump too hot",
                             "severity" => "critical", "status" => "open", "metric" => "temperature", "reading" => "91.5",
                             "threshold" => "85.0", "unit" => "°C", "resolved_at" => nil,
                             "work_order" => alert.work_order.work_order_number)
    end
  end

  describe ".sensor_readings_csv" do
    it "generates valid CSV" do
      rows = parse(described_class.sensor_readings_csv([
        { id: 1, asset_id: 10, metric_name: "temperature", value: 72.5, unit: "C", source: "mqtt", device_id: "dev-1",
          quality: "good", recorded_at: "2026-05-01T10:00:00Z" }
      ]))

      expect(rows.headers).to include("metric_name", "value", "unit", "recorded_at")
      expect(rows.size).to eq(1)
    end
  end
end
