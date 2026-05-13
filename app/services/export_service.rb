require "csv"

class ExportService
  def self.work_orders_csv(work_orders)
    headers = %w[
      work_order_number title priority status
      asset assignee due_date started_at completed_at
      labor_cost parts_cost created_at
    ]

    CSV.generate(headers: true) do |csv|
      csv << headers
      Array(work_orders).each do |wo|
        csv << [
          wo[:work_order_number] || wo["work_order_number"],
          wo[:title]             || wo["title"],
          wo[:priority]          || wo["priority"],
          wo[:status]            || wo["status"],
          (wo[:asset] || wo["asset"]).then { |a| a.is_a?(Hash) ? a[:name] : a.to_s },
          (wo[:assignee] || wo["assignee"]).then { |u| u.is_a?(Hash) ? u[:full_name] : u.to_s },
          wo[:due_date]          || wo["due_date"],
          wo[:started_at]        || wo["started_at"],
          wo[:completed_at]      || wo["completed_at"],
          wo[:labor_cost]        || wo["labor_cost"],
          wo[:parts_cost]        || wo["parts_cost"],
          wo[:created_at]        || wo["created_at"]
        ]
      end
    end
  end

  def self.assets_csv(assets)
    headers = %w[id name asset_tag status location operational degraded down health_score]

    CSV.generate(headers: true) do |csv|
      csv << headers
      Array(assets).each do |asset|
        csv << [
          asset[:asset_id]    || asset["asset_id"],
          asset[:location]    || asset["location"],
          asset[:total]       || asset["total"],
          asset[:operational] || asset["operational"],
          asset[:degraded]    || asset["degraded"],
          asset[:down]        || asset["down"],
          asset[:health_score] || asset["health_score"]
        ]
      end
    end
  end

  def self.pm_compliance_csv(data)
    headers = %w[period scheduled completed skipped compliance_rate]

    CSV.generate(headers: true) do |csv|
      csv << headers
      Array(data).each do |row|
        csv << [
          row[:month]            || row["month"],
          row[:scheduled]        || row["scheduled"],
          row[:completed]        || row["completed"],
          row[:skipped]          || row["skipped"],
          row[:compliance_rate]  || row["compliance_rate"]
        ]
      end
    end
  end

  def self.sensor_readings_csv(readings)
    headers = %w[id asset_id metric_name value unit source device_id quality recorded_at]

    CSV.generate(headers: true) do |csv|
      csv << headers
      Array(readings).each do |r|
        csv << [
          r[:id], r[:asset_id], r[:metric_name], r[:value],
          r[:unit], r[:source], r[:device_id], r[:quality], r[:recorded_at]
        ]
      end
    end
  end
end
