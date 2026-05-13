require "rails_helper"

RSpec.describe ExportService, type: :service do
  describe ".work_orders_csv" do
    let(:work_orders) do
      [
        { work_order_number: "WO-000001", title: "Fix pump", priority: "high",
          status: "completed", asset: { name: "Pump A" }, assignee: { full_name: "Jane" },
          due_date: "2026-05-01", started_at: nil, completed_at: "2026-05-02",
          labor_cost: 100, parts_cost: 50, created_at: "2026-04-30" },
        { work_order_number: "WO-000002", title: "Check valve", priority: "low",
          status: "open", asset: "Valve B", assignee: nil,
          due_date: nil, started_at: nil, completed_at: nil,
          labor_cost: 0, parts_cost: 0, created_at: "2026-05-01" }
      ]
    end

    it "generates valid CSV with headers" do
      csv = ExportService.work_orders_csv(work_orders)
      rows = CSV.parse(csv, headers: true)
      expect(rows.headers).to include("work_order_number", "title", "priority", "status")
      expect(rows.size).to eq(2)
      expect(rows.first["work_order_number"]).to eq("WO-000001")
    end
  end

  describe ".assets_csv" do
    let(:location_data) do
      [
        { location: "Floor 1", total: 10, operational: 8, degraded: 1, down: 1, health_score: 90.0 },
        { location: "Floor 2", total: 5,  operational: 5, degraded: 0, down: 0, health_score: 100.0 }
      ]
    end

    it "generates valid CSV" do
      csv = ExportService.assets_csv(location_data)
      rows = CSV.parse(csv, headers: true)
      expect(rows.headers).to include("operational", "degraded", "down", "health_score")
      expect(rows.size).to eq(2)
    end
  end

  describe ".pm_compliance_csv" do
    let(:monthly_data) do
      [
        { month: "2026-04", scheduled: 10, completed: 8, skipped: 1, compliance_rate: 88.9 },
        { month: "2026-05", scheduled: 8,  completed: 7, skipped: 0, compliance_rate: 100.0 }
      ]
    end

    it "generates valid CSV" do
      csv = ExportService.pm_compliance_csv(monthly_data)
      rows = CSV.parse(csv, headers: true)
      expect(rows.headers).to include("period", "scheduled", "completed", "skipped", "compliance_rate")
      expect(rows.size).to eq(2)
      expect(rows.first["period"]).to eq("2026-04")
    end
  end

  describe ".sensor_readings_csv" do
    let(:readings) do
      [
        { id: 1, asset_id: 10, metric_name: "temperature", value: 72.5,
          unit: "C", source: "mqtt", device_id: "dev-1", quality: "good",
          recorded_at: "2026-05-01T10:00:00Z" }
      ]
    end

    it "generates valid CSV" do
      csv = ExportService.sensor_readings_csv(readings)
      rows = CSV.parse(csv, headers: true)
      expect(rows.headers).to include("metric_name", "value", "unit", "recorded_at")
      expect(rows.size).to eq(1)
    end
  end
end
