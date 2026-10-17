require "csv"

# The CSV files behind the Export menus: one builder per report, each taking what that report
# actually produces. Opens cleanly in Excel (UTF-8 with a byte order mark).
#
# Text in these files can come from anyone, including people who report a problem without an
# account (a work order's title, an asset's name), and a spreadsheet runs a cell that starts with
# = + - or @ as a formula. Such text is written with a leading ' so it stays text.
class ExportService
  BYTE_ORDER_MARK = "﻿".freeze
  FORMULA_START = /\A[=+\-@\t\r]/

  # `work_orders` are WorkOrder records (with asset and assignee loaded).
  def self.work_orders_csv(work_orders)
    build(%w[work_order_number title priority status asset assignee due_date started_at completed_at
             labor_cost parts_cost total_cost created_at]) do |csv|
      work_orders.each do |wo|
        csv << [
          wo.work_order_number, wo.title, wo.priority, wo.status, wo.asset&.name, wo.assignee&.full_name,
          wo.due_date, wo.started_at, wo.completed_at, wo.labor_cost, wo.parts_cost,
          wo.labor_cost.to_d + wo.parts_cost.to_d, wo.created_at
        ]
      end
    end
  end

  # The asset health report's table: one row per place.
  def self.asset_health_csv(by_location)
    table(%w[location total operational degraded down health_score], by_location,
          %i[location total operational degraded down health_score])
  end

  def self.pm_compliance_csv(by_month)
    table(%w[month scheduled completed skipped compliance_rate], by_month,
          %i[month scheduled completed skipped compliance_rate])
  end

  def self.technician_performance_csv(technicians)
    table(%w[name assigned completed completion_rate avg_resolution_hours on_time_rate first_time_fix_rate
             critical_completed],
          technicians,
          %i[name assigned completed completion_rate avg_resolution_hours on_time_rate first_time_fix_rate
             critical_completed])
  end

  def self.cost_by_asset_csv(assets)
    table(%w[asset labor_cost parts_cost total_cost work_orders], assets,
          %i[asset_name labor_cost parts_cost total_cost wo_count])
  end

  def self.cost_by_location_csv(locations)
    table(%w[location labor_cost parts_cost total_cost work_orders], locations,
          %i[location_name labor_cost parts_cost total_cost wo_count])
  end

  # IotAlert records (with rule, asset and work order loaded).
  def self.iot_alerts_csv(alerts)
    build(%w[raised_at asset location rule severity status metric reading threshold unit acknowledged_at resolved_at
             work_order]) do |csv|
      alerts.each do |alert|
        csv << [
          alert.created_at, alert.asset.name, alert.asset.location&.full_path, alert.iot_rule.name, alert.severity, alert.status,
          alert.metric_name, alert.triggered_value, alert.threshold, alert.iot_rule.unit, alert.acknowledged_at,
          alert.resolved_at, alert.work_order&.work_order_number
        ]
      end
    end
  end

  # ActivityLog records (with the person loaded): the audit log, newest first. Only the names of changed fields are
  # kept in the log, so only those are exported.
  def self.activity_logs_csv(logs)
    build(%w[when who email what record record_type fields_changed ip_address]) do |csv|
      logs.each do |log|
        csv << [
          log.created_at, log.user&.full_name || "System", log.user&.email, log.action, log.resource_name,
          log.resource_type, Array(log.metadata["changed"]).join("; "), log.ip_address
        ]
      end
    end
  end

  def self.sensor_readings_csv(readings)
    table(%w[id asset_id metric_name value unit source device_id quality recorded_at], readings,
          %i[id asset_id metric_name value unit source device_id quality recorded_at])
  end

  # One cell: text that a spreadsheet would run is made plain text, times are written the same way
  # everywhere, anything else is left to CSV.
  def self.cell(value)
    case value
    when String then value.match?(FORMULA_START) ? "'#{value}" : value
    when Time, DateTime, ActiveSupport::TimeWithZone then value.in_time_zone.strftime("%Y-%m-%d %H:%M")
    when Date then value.iso8601
    else value
    end
  end

  def self.build(headers)
    body = CSV.generate do |csv|
      csv << headers
      yield(Cells.new(csv))
    end
    BYTE_ORDER_MARK + body
  end
  private_class_method :build

  # A table of hashes: each header takes the value under its key (symbol or string).
  def self.table(headers, rows, keys)
    build(headers) do |csv|
      Array(rows).each { |row| csv << keys.map { |key| row[key] || row[key.to_s] } }
    end
  end
  private_class_method :table

  # Adds a row, passing every cell through `cell`.
  class Cells
    def initialize(csv) = @csv = csv

    def <<(values)
      @csv << values.map { |value| ExportService.cell(value) }
    end
  end
end
