module Api
  module V1
    module Reports
      class IotController < Reports::BaseController
        # GET /api/v1/reports/iot/alert_summary
        def alert_summary
          from, to = date_range
          org      = current_organization

          base = IotAlert.joins(:asset)
                         .where(assets: { organization_id: org.id })
                         .where(created_at: from..to)

          base = base.joins(:iot_rule).where(iot_rules: { metric_name: params[:metric_name] }) if params[:metric_name].present?
          base = base.where(asset_id: params[:asset_id]) if params[:asset_id].present?

          total  = base.count
          by_status = base.group(:status).count

          by_asset = base.joins(:asset)
            .group("assets.name")
            .group(:status)
            .group(Arel.sql("iot_alerts.iot_rule_id"))
            .joins(:iot_rule)
            .count
            .each_with_object({}) do |((asset_name, status, _rule_id), count), h|
              h[asset_name] ||= { asset_name: asset_name, alert_count: 0, critical: 0, resolved: 0, total: 0 }
              h[asset_name][:alert_count] += count
              h[asset_name][:resolved]    += count if status == 2
              h[asset_name][:total]       += count
            end.values

          by_asset.each do |a|
            a[:resolved_rate] = a[:total].positive? ? (a[:resolved].to_f / a[:total] * 100).round(1) : 0
          end

          by_metric = base.joins(:iot_rule)
            .group("iot_alerts.metric_name, iot_alerts.threshold")
            .select(
              "iot_alerts.metric_name, iot_alerts.threshold,
               COUNT(*)                          as alert_count,
               AVG(iot_alerts.triggered_value)   as avg_breach_value"
            ).map do |r|
            { metric: r.metric_name, alert_count: r.alert_count.to_i,
              avg_breach_value: r.avg_breach_value.to_f.round(2), threshold: r.threshold.to_f }
          end

          trend = base.group(Arel.sql("DATE_TRUNC('day', iot_alerts.created_at)::date"))
                      .group(:status)
                      .count
                      .each_with_object({}) do |((date, status), count), h|
                        h[date] ||= { date: date, alerts: 0, resolved: 0 }
                        h[date][:alerts]   += count
                        h[date][:resolved] += count if status == 2
                      end.values.sort_by { |t| t[:date] }

          render json: {
            total_alerts:               total,
            open:                       by_status.fetch("open", 0),
            acknowledged:               by_status.fetch("acknowledged", 0),
            resolved:                   by_status.fetch("resolved", 0),
            auto_work_orders_created:   base.where.not(work_order_id: nil).count,
            by_asset:                   by_asset,
            by_metric:                  by_metric,
            trend:                      trend
          }
        end

        # GET /api/v1/reports/iot/sensor_trends
        def sensor_trends
          asset = current_organization.assets.find(params.require(:asset_id))
          from, to = date_range
          interval = %w[hourly daily weekly].include?(params[:interval]) ? params[:interval] : "hourly"
          period_type = { "hourly" => 0, "daily" => 1, "weekly" => 2 }[interval]

          metrics = params[:metric_name].to_s.split(",").map(&:strip).select(&:present?)
          metrics = SensorReading.where(asset_id: asset.id).distinct.pluck(:metric_name) if metrics.empty?

          cache_key = "reports/sensor_trends/#{asset.id}/#{metrics.sort.join(',')}/#{interval}/#{from.to_date}/#{to.to_date}"
          data = Rails.cache.fetch(cache_key, expires_in: 5.minutes) do
            build_sensor_trends(asset, metrics, from, to, period_type, interval)
          end

          render json: {
            asset:   { id: asset.id, name: asset.name },
            period:  { from: from.iso8601, to: to.iso8601, interval: interval },
            metrics: data
          }
        end

        private

        def build_sensor_trends(asset, metrics, from, to, period_type, interval)
          metrics.index_with do |metric|
            aggs = SensorAggregate.where(asset_id: asset.id, metric_name: metric, period_type: period_type)
                                  .where(period_start: from..to)
                                  .order(:period_start)

            overall = SensorReading.where(asset_id: asset.id, metric_name: metric)
                                   .where(recorded_at: from..to)
                                   .pick(Arel.sql("MIN(value), MAX(value), AVG(value)"))

            unit      = SensorReading.where(asset_id: asset.id, metric_name: metric).order(recorded_at: :desc).pick(:unit)
            threshold = IotRule.where(asset_id: asset.id, metric_name: metric, status: :active).pick(:threshold)

            entry = {
              unit:  unit,
              min:   overall&.[](0)&.to_f&.round(4),
              max:   overall&.[](1)&.to_f&.round(4),
              avg:   overall&.[](2)&.to_f&.round(4),
              data:  aggs.map { |a|
                { time: a.period_start, avg: a.avg_value.to_f.round(4),
                  min: a.min_value.to_f.round(4), max: a.max_value.to_f.round(4) }
              }
            }
            entry[:threshold] = threshold.to_f if threshold
            entry
          end
        end
      end
    end
  end
end
