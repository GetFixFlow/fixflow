module Iot
  # What the IoT alerts of one company looked like over a period: how many, how serious, how many were
  # dealt with, and how well each rule did. Counted from the stored alerts; nothing is estimated.
  class AlertReport
    DAILY_UP_TO_DAYS = 92 # a longer period is shown by the week, so a chart never has thousands of points
    SERIES_METRICS = 5

    # `asset_ids` and `priorities` are the Filters panel's choices (nil / empty: no filter).
    def initialize(organization, from:, to:, asset_ids: nil, priorities: [])
      @org = organization
      @from = from
      @to = to
      @asset_ids = asset_ids
      @priorities = priorities
    end

    def summary
      total = alerts.count
      resolved = alerts.where(status: :resolved).count
      {
        total_alerts:  total,
        critical_count: alerts.joins(:iot_rule).where(iot_rules: { wo_priority: :critical }).count,
        resolved_rate: total.zero? ? 0 : ((resolved.to_f / total) * 100).round(1),
        open_count:    alerts.where(status: :open).count,
        work_orders_created: alerts.where.not(work_order_id: nil).count,
        trend:         trend,
        sensor_series: sensor_series
      }
    end

    # One row for each rule that is active or raised an alert in the period.
    def rule_effectiveness
      stats = alerts.group(:iot_rule_id).pluck(
        :iot_rule_id,
        Arel.sql("COUNT(*)"),
        Arel.sql("COUNT(*) FILTER (WHERE iot_alerts.status = #{IotAlert.statuses.fetch('resolved')})"),
        Arel.sql("COUNT(iot_alerts.work_order_id)"),
        Arel.sql("AVG(EXTRACT(EPOCH FROM (iot_alerts.resolved_at - iot_alerts.created_at)) / 3600) " \
                 "FILTER (WHERE iot_alerts.resolved_at IS NOT NULL)")
      ).index_by(&:first)

      rules = IotRule.where(organization_id: @org.id).includes(:asset)
      rules = rules.where(id: stats.keys).or(rules.where(status: :active))
      {
        active_count: IotRule.where(organization_id: @org.id, status: :active).count,
        rules: rules.order(:name).map { |rule| rule_row(rule, stats[rule.id]) }
      }
    end

    # The alerts themselves, newest first, for the CSV.
    def rows(limit)
      alerts.includes(:iot_rule, :work_order, asset: :location).order(created_at: :desc, id: :desc).limit(limit)
    end

    private

    def alerts
      @alerts ||= begin
        scope = IotAlert.joins(:asset).where(assets: { organization_id: @org.id }).where(iot_alerts: { created_at: @from..@to })
        scope = scope.where(asset_id: @asset_ids) if @asset_ids
        scope = scope.joins(:iot_rule).where(iot_rules: { wo_priority: priority_numbers }) if @priorities.any?
        scope
      end
    end

    def priority_numbers = IotRule.wo_priorities.values_at(*@priorities)

    def rule_row(rule, stat)
      _id, count, resolved, work_orders, hours = stat || [rule.id, 0, 0, 0, nil]
      {
        rule_id: rule.id, rule_name: rule.name, asset_name: rule.asset&.name, status: rule.status,
        trigger_count: count, wo_created: work_orders,
        resolve_rate: count.zero? ? 0 : ((resolved.to_f / count) * 100).round(1),
        avg_resolution_hours: hours.to_f.round(1)
      }
    end

    def weekly? = ((@to.to_date - @from.to_date).to_i + 1) > DAILY_UP_TO_DAYS

    # One point for each day (or week) of the period, zeros included, with the alerts raised by severity and how
    # many of those have since been resolved.
    def trend
      by_severity = alerts.joins(:iot_rule).group(period_sql, Arel.sql("iot_rules.wo_priority")).count
      resolved = alerts.where(status: :resolved).group(period_sql).count.transform_keys(&:to_date)
      counts = by_severity.each_with_object(Hash.new { |h, k| h[k] = {} }) do |((date, priority), count), h|
        h[date.to_date][priority_name(priority)] = count
      end
      periods.map do |start|
        raised = counts[start]
        { period: start.iso8601, critical: raised.fetch("critical", 0), high: raised.fetch("high", 0),
          medium: raised.fetch("medium", 0), low: raised.fetch("low", 0), resolved: resolved.fetch(start, 0) }
      end
    end

    # Grouping by an enum gives its name ("critical"), though a raw column can give its number.
    def priority_name(value) = value.is_a?(Integer) ? IotRule.wo_priorities.key(value) : value.to_s

    # The day (or week, starting Monday) an alert was raised, in the company's time zone.
    def period_sql
      zone = ActiveRecord::Base.connection.quote(Time.zone.tzinfo.name)
      unit = weekly? ? "week" : "day"
      Arel.sql("DATE_TRUNC('#{unit}', iot_alerts.created_at AT TIME ZONE 'UTC' AT TIME ZONE #{zone})::date")
    end

    def periods
      first = @from.in_time_zone.to_date
      first = first.beginning_of_week(:monday) if weekly?
      (first..@to.in_time_zone.to_date).step(weekly? ? 7 : 1).to_a
    end

    # The metrics of the one asset asked for, as a daily average; empty unless exactly one asset is chosen.
    def sensor_series
      return [] unless @asset_ids&.size == 1

      readings = SensorReading.where(organization_id: @org.id, asset_id: @asset_ids.first, recorded_at: @from..@to)
      metrics = readings.group(:metric_name).order(Arel.sql("COUNT(*) DESC")).limit(SERIES_METRICS).count.keys
      zone = ActiveRecord::Base.connection.quote(Time.zone.tzinfo.name)
      local = "sensor_readings.recorded_at AT TIME ZONE 'UTC' AT TIME ZONE #{zone}"
      metrics.map do |metric|
        average = readings.where(metric_name: metric).group(Arel.sql("DATE_TRUNC('day', #{local})::date")).average(:value)
        unit = readings.where(metric_name: metric).order(recorded_at: :desc).pick(:unit)
        { metric: metric, unit: unit.to_s,
          data: average.sort_by { |date, _| date }.map { |date, value| { time: date.to_date.iso8601, value: value.to_f.round(3) } } }
      end
    end
  end
end
