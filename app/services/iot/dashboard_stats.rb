module Iot
  # The figures on the IoT Monitor screen, for one company: what is sending readings, what is
  # wrong, and how busy the sensors have been. Everything is counted from the stored readings,
  # alerts and rules; nothing is estimated.
  class DashboardStats
    ACTIVITY_HOURS = 168 # a week, so the screen's 1h / 6h / 24h / 7d buttons all have data
    RECENT_ALERTS = 10
    ASSETS_SHOWN = 24

    def initialize(organization, now: Time.current)
      @org = organization
      @now = now
      @stale_after = organization.settings_with_defaults["iot_stale_threshold"].to_i.seconds
    end

    def call
      {
        active_sensors:           latest_readings.count { |reading| !stale?(reading) },
        monitored_assets:         readings.where(recorded_at: (@now - 24.hours)..).distinct.count(:asset_id),
        readings_per_hour:        last_hour,
        readings_per_hour_change: change_from_previous_hour,
        **open_alert_counts,
        active_rules:             rules.active.count,
        triggered_rules:          rules.where(last_triggered_at: @now.beginning_of_day..).count,
        recent_alerts:            IotAlertBlueprint.render_as_hash(recent_alerts),
        hourly_readings:          hourly_readings,
        asset_status:             asset_status
      }
    end

    private

    def readings = SensorReading.where(organization_id: @org.id)
    def rules    = IotRule.where(organization_id: @org.id)

    def company_alerts
      IotAlert.joins(:asset).where(assets: { organization_id: @org.id })
    end

    # The newest reading of each metric on each asset, within the last 24 hours.
    def latest_readings
      @latest_readings ||= readings.where(recorded_at: (@now - 24.hours)..)
                                   .select("DISTINCT ON (asset_id, metric_name) *")
                                   .order(:asset_id, :metric_name, recorded_at: :desc).to_a
    end

    def stale?(reading) = reading.recorded_at < @now - @stale_after

    def last_hour = readings.where(recorded_at: (@now - 1.hour)..).count

    # Per cent more (or fewer) readings than in the hour before; 0 when there were none to compare with.
    def change_from_previous_hour
      before = readings.where(recorded_at: (@now - 2.hours)...(@now - 1.hour)).count
      return 0 if before.zero?

      (((last_hour - before).to_f / before) * 100).round
    end

    def open_alert_counts
      # Grouping by an enum gives its names ("critical"), not its numbers.
      by_priority = company_alerts.where(status: :open).joins(:iot_rule).group("iot_rules.wo_priority").count
      count = ->(name) { by_priority.fetch(name, 0) }
      {
        open_alerts: by_priority.values.sum, critical_alerts: count.call("critical"),
        high_alerts: count.call("high"), medium_alerts: count.call("medium")
      }
    end

    def recent_alerts
      company_alerts.includes(:iot_rule, :work_order, :acknowledged_by, asset: :location).recent.limit(RECENT_ALERTS)
    end

    # One point for each of the last 168 hours (zeros included, so the chart has no gaps), labelled by the
    # company's local hour. `alerts` is how many alerts were raised in that hour.
    def hourly_readings
      zone = Time.zone
      from = (@now - (ACTIVITY_HOURS - 1).hours).in_time_zone(zone).beginning_of_hour
      counts = counts_by_hour(readings, SensorReading.arel_table[:recorded_at], from)
      alerts = counts_by_hour(company_alerts, IotAlert.arel_table[:created_at], from)
      Array.new(ACTIVITY_HOURS) do |n|
        hour = from + n.hours
        key = hour.strftime("%Y-%m-%d %H")
        { hour: hour.strftime("%a %H:00"), count: counts.fetch(key, 0), alerts: alerts.fetch(key, 0) }
      end
    end

    # `column` is an Arel attribute (never text from outside), so it is quoted properly and nothing is interpolated into the filter.
    def counts_by_hour(scope, column, from)
      connection = ActiveRecord::Base.connection
      name = "#{connection.quote_table_name(column.relation.name)}.#{connection.quote_column_name(column.name)}"
      local = "#{name} AT TIME ZONE 'UTC' AT TIME ZONE #{connection.quote(Time.zone.tzinfo.name)}"
      scope.where(column.gteq(from))
           .group(Arel.sql("TO_CHAR(DATE_TRUNC('hour', #{local}), 'YYYY-MM-DD HH24')"))
           .count
    end

    # Each monitored asset with its metrics, those with a metric past its limit first.
    def asset_status
      by_asset = latest_readings.group_by(&:asset_id)
      return [] if by_asset.empty?

      assets = Asset.where(id: by_asset.keys).kept.index_by(&:id)
      limits = rules.active.where(asset_id: by_asset.keys).group_by { |rule| [rule.asset_id, rule.metric_name] }
      rows = by_asset.filter_map do |asset_id, asset_readings|
        asset = assets[asset_id]
        asset_row(asset, asset_readings, limits) if asset
      end
      rows.sort_by { |row| [row[:metrics].any? { |metric| metric[:is_breached] } ? 0 : 1, row[:asset_name]] }.first(ASSETS_SHOWN)
    end

    def asset_row(asset, asset_readings, limits)
      metrics = asset_readings.sort_by(&:metric_name).map do |reading|
        metric_status(reading, limits.fetch([asset.id, reading.metric_name], []))
      end
      { asset_id: asset.id, asset_name: asset.name, asset_tag: asset.asset_tag, metrics: metrics }
    end

    # The rule the reading breaks, or else the rule it is nearest to (the first), or none.
    def metric_status(reading, metric_rules)
      rule = metric_rules.find { |candidate| candidate.breach?(reading.value) } || metric_rules.first
      {
        metric_name: reading.metric_name, metric_unit: reading.unit, latest_value: reading.value.to_f,
        latest_reading_at: reading.recorded_at, is_breached: rule&.breach?(reading.value) || false, is_stale: stale?(reading),
        threshold: rule&.threshold&.to_f, threshold_operator: rule&.operator, rule_id: rule&.id,
        pct_of_threshold: rule && percent_of_limit(rule, reading.value.to_f)
      }
    end

    # How close the reading is to the limit, in per cent: for "above" rules the reading over the limit, for
    # "below" rules the limit over the reading. Not given for other kinds of rule, or a zero or negative number.
    def percent_of_limit(rule, value)
      limit = rule.threshold.to_f
      return unless limit.positive? && value.positive?

      case rule.operator
      when "gt", "gte" then ((value / limit) * 100).round
      when "lt", "lte" then ((limit / value) * 100).round
      end
    end
  end
end
