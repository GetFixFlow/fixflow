module Iot
  class AggregateReadingsJob < ApplicationJob
    queue_as :scheduled

    def perform
      period_end   = Time.current.beginning_of_hour
      period_start = period_end - 1.hour

      asset_metrics = SensorReading
        .where(recorded_at: period_start...period_end)
        .select(:asset_id, :metric_name)
        .distinct

      asset_metrics.each do |row|
        upsert_aggregate(row.asset_id, row.metric_name, period_start, period_end)
      end

      Rails.logger.info "[Iot::AggregateReadingsJob] Aggregated #{asset_metrics.size} asset/metric pairs for #{period_start}"
    end

    private

    def upsert_aggregate(asset_id, metric_name, period_start, period_end)
      stats = SensorReading
        .where(asset_id: asset_id, metric_name: metric_name)
        .where(recorded_at: period_start...period_end)
        .pick(
          Arel.sql("MIN(value)"),
          Arel.sql("MAX(value)"),
          Arel.sql("AVG(value)"),
          Arel.sql("COUNT(*)")
        )

      return unless stats

      min_val, max_val, avg_val, count = stats

      SensorAggregate.find_or_initialize_by(
        asset_id:    asset_id,
        metric_name: metric_name,
        period_start: period_start,
        period_type: :hourly
      ).update!(
        min_value:     min_val,
        max_value:     max_val,
        avg_value:     avg_val,
        reading_count: count
      )
    end
  end
end
