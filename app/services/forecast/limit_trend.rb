module Forecast
  # Says when a sensor is on course to reach a limit the company already set, from the way the sensor has been moving. The limit
  # is the one on an alert rule (IoT, Rules): FixFlow does not invent one. It is statistics on this server: nothing is sent to an
  # AI provider.
  #
  # The last 30 days are taken a day at a time (the median of each day's good readings, so a daily cycle and a few spikes do not
  # bend it), and a straight line is fitted through those days. It says something only when the line is a good account of the
  # sensor, and it says how sure it is:
  #
  # - at least 14 days with at least three good readings each;
  # - the line explains at least half of the movement (R squared). Over 14 or more days that puts the slope more than three times its
  #   own uncertainty, which is what keeps the shallow end of the range below still a slope towards the limit;
  # - the sensor is moving towards the limit, and has not reached it;
  # - the limit is within 90 days at this rate.
  #
  # The range is the same line with its slope as steep, and as shallow, as the data allow (two standard errors each way). Because
  # the slope must be three times its own uncertainty to be reported at all, the shallow end is always still a slope towards the limit.
  class LimitTrend
    WINDOW      = 30.days
    MIN_DAYS    = 14
    MIN_PER_DAY = 3
    MIN_R2      = 0.5
    HORIZON     = 90.0 # days
    SPREAD      = 2.0  # standard errors each way, for the range
    CACHE_FOR   = 10.minutes

    # The fit, with ? where the values go (the start of the first day, asset, metric, quality, from, until, readings needed in a day).
    FIT_SQL = <<~SQL.squish.freeze
      WITH daily AS (
        SELECT EXTRACT(EPOCH FROM date_trunc('day', recorded_at) - ?::timestamp) / 86400.0 + 0.5 AS x,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS v
        FROM sensor_readings
        WHERE asset_id = ? AND metric_name = ? AND quality = ? AND recorded_at >= ? AND recorded_at <= ?
        GROUP BY date_trunc('day', recorded_at) HAVING count(*) >= ?)
      SELECT count(*) AS points, regr_slope(v, x) AS slope, regr_intercept(v, x) AS intercept, regr_r2(v, x) AS r2,
             stddev_samp(v) AS sy, stddev_samp(x) AS sx, max(x) - min(x) AS span
      FROM daily
    SQL

    Result = Struct.new(:rule, :current, :slope_per_day, :limit, :days_left, :days_soonest, :days_latest, :r2, :days_of_history,
                        :points, keyword_init: true) do
      # The sensor moves by this many units a day towards the limit.
      def rising? = slope_per_day.positive?
    end

    # => the Result for this rule, or nil when there is nothing honest to say.
    def self.for_rule(rule, now: Time.current)
      key = "forecast/limit/#{rule.id}/#{rule.updated_at.to_i}/#{now.to_i / CACHE_FOR.to_i}"
      cached = Rails.cache.fetch(key, expires_in: CACHE_FOR) { new(rule, now).result&.to_h&.except(:rule) || false }
      Result.new(rule: rule, **cached) if cached
    end

    def initialize(rule, now)
      @rule = rule
      @now = now
    end

    def result
      return if @rule.operator == "eq"

      stats = fit
      return unless stats && enough?(stats)

      slope = stats["slope"].to_f
      return unless slope.nonzero?

      build(stats, stats["intercept"].to_f + (slope * @elapsed), slope, limit_for(slope))
    end

    private

    # One straight line through the daily medians, worked out by the database. x is days since the start of the window's first day,
    # each day counted at its middle (that is where its median is).
    def fit
      from = @now - WINDOW
      origin = from.beginning_of_day
      @elapsed = (@now - origin) / 1.day
      values = [origin, @rule.asset_id, @rule.metric_name, SensorReading.qualities[:good], from, @now, MIN_PER_DAY]
      row = SensorReading.connection.select_one(SensorReading.sanitize_sql_array([FIT_SQL, *values]))
      return unless row && row["points"].to_i > 2 && row["slope"]

      row.merge("se" => standard_error(row))
    end

    def standard_error(row)
      n = row["points"].to_i
      return 0.0 if row["sx"].to_f.zero?

      Math.sqrt([1.0 - row["r2"].to_f, 0.0].max / (n - 2)) * row["sy"].to_f.fdiv(row["sx"].to_f)
    end

    def enough?(stats)
      stats["points"].to_i >= MIN_DAYS && stats["r2"].to_f >= MIN_R2
    end

    # The limit the sensor is heading for: the rule's, on the side it is moving towards.
    def limit_for(slope)
      case @rule.operator
      when "gt", "gte", "lt", "lte" then @rule.threshold.to_f
      else slope.positive? ? @rule.threshold_max.to_f : @rule.threshold.to_f # outside a range
      end
    end

    # The Result when the sensor is heading for the limit, has not reached it, and would within the horizon; else nil.
    def build(stats, current, slope, limit)
      return unless heading_towards?(slope)

      distance = (limit - current) * (slope.positive? ? 1 : -1)
      return unless distance.positive?

      days = distance / slope.abs
      return if days > HORIZON

      steepest = slope.abs + (SPREAD * stats["se"])
      shallowest = slope.abs - (SPREAD * stats["se"])
      Result.new(
        rule: @rule, current: current, slope_per_day: slope, limit: limit, days_left: days, days_soonest: distance / steepest,
        days_latest: distance / shallowest, r2: stats["r2"].to_f,
        days_of_history: stats["span"].to_f.round, points: stats["points"].to_i
      )
    end

    # "above" and "at or above" limits are approached from below, "below" ones from above; a range from inside.
    def heading_towards?(slope)
      case @rule.operator
      when "gt", "gte" then slope.positive?
      when "lt", "lte" then slope.negative?
      else true
      end
    end
  end
end
