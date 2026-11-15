module Iot
  # Says whether a sensor reading is far outside what that sensor usually reads, with no limit set by anyone: what is usual is
  # learned from the sensor's own last two weeks. It is arithmetic done here on the server; nothing is sent to an AI provider.
  #
  # A reading is unusual when it is at least SCORE "typical deviations" from the middle (the median) of the recent readings, the
  # deviation being the median absolute deviation, which a few earlier spikes do not stretch the way a standard deviation is.
  # It says nothing until the sensor has history enough to judge by, and it leaves alone the sensors it cannot judge:
  #
  # - a sensor with a few distinct values, such as an on/off switch or a status code (nothing "usual" about a 1);
  # - a counter that only goes up, such as running hours (every new reading is "unusual" next to the old ones);
  # - a reading marked bad, or an old one being loaded in after the fact (not something to be told about now).
  #
  # Where the sensor's behaviour is plain and steady, the deviation is never taken as less than 2% of its middle value, so a
  # sensor that always reads 20.0 is not flagged for 20.1.
  class AnomalyDetector
    WINDOW        = 14.days
    BASELINE_MAX  = 2_000   # the most recent readings used
    MIN_READINGS  = 60
    MIN_SPAN      = 24.hours # the history must reach back at least this far
    MIN_DISTINCT  = 5
    SCORE         = 6.0
    SCALE_FLOOR   = 0.02
    MAD_TO_SIGMA  = 1.4826 # makes the deviation comparable with a standard deviation for ordinary (bell-shaped) data
    MEAN_TO_SIGMA = 1.2533 # the same, for the average deviation
    FRESH         = 1.hour # a reading older than this is history being loaded in, not news
    QUIET         = 6.hours # after a flag, the same sensor is not flagged again for this long
    BASELINE_TTL  = 10.minutes

    Baseline = Struct.new(:middle, :scale, :low, :high, :readings, keyword_init: true)

    # => the SensorAnomaly it raised, or nil.
    def self.check(reading, now: Time.current)
      new(reading, now: now).check
    end

    def initialize(reading, now: Time.current)
      @reading = reading
      @now = now
    end

    def check
      return unless judgeable?

      baseline = baseline_for_reading
      return unless baseline

      score = score_for(baseline)
      return if score < SCORE || recently_flagged?

      raise_flag(baseline, score)
    end

    private

    attr_reader :reading, :now

    def judgeable?
      reading.good? && reading.recorded_at > now - FRESH && !Meter.for_sensor(reading.asset_id, reading.metric_name).exists?
    end

    # How far the reading is from the middle, in typical deviations.
    def score_for(baseline) = ((reading.value.to_f - baseline.middle) / baseline.scale).abs

    def recently_flagged?
      SensorAnomaly.unscoped.where(asset_id: reading.asset_id, metric_name: reading.metric_name)
                   .exists?(["created_at > ?", now - QUIET])
    end

    def raise_flag(baseline, score)
      SensorAnomaly.create!(
        organization_id: reading.organization_id || reading.asset.organization_id, asset_id: reading.asset_id,
        metric_name: reading.metric_name, unit: reading.unit, value: reading.value, recorded_at: reading.recorded_at,
        usual_low: baseline.low, usual_high: baseline.high, usual_middle: baseline.middle,
        score: score.round(2), baseline_count: baseline.readings, created_at: now
      )
    end

    # What is usual for this sensor, kept for a few minutes so a sensor that reports every second costs nothing extra.
    def baseline_for_reading
      key = "iot/anomaly/baseline/#{reading.asset_id}/#{reading.metric_name}"
      cached = Rails.cache.fetch(key, expires_in: BASELINE_TTL) { learn&.to_h || false }
      Baseline.new(**cached) if cached
    end

    def history
      SensorReading.unscoped
                   .where(asset_id: reading.asset_id, metric_name: reading.metric_name, quality: SensorReading.qualities[:good])
                   .where(recorded_at: (now - WINDOW)...reading.recorded_at)
                   .where.not(id: reading.id)
                   .order(recorded_at: :desc).limit(BASELINE_MAX)
    end

    # Nil when there is too little to judge by, or the sensor is one that cannot be judged this way.
    def learn
      stats = summary
      return unless stats && enough?(stats)
      return if counter?

      middle = stats["middle"].to_f
      scale = [deviation(stats), middle.abs * SCALE_FLOOR, Float::EPSILON].max
      Baseline.new(middle: middle, scale: scale, low: stats["low"].to_f, high: stats["high"].to_f, readings: stats["readings"].to_i)
    end

    # The typical deviation. When more than half the readings sit exactly on the middle the median deviation is zero, which would
    # make the slightest blip "unusual", so the average deviation stands in for it.
    def deviation(stats)
      mad = stats["mad"].to_f
      mad.positive? ? mad * MAD_TO_SIGMA : stats["average_deviation"].to_f * MEAN_TO_SIGMA
    end

    def summary
      SensorReading.connection.select_one(<<~SQL.squish)
        WITH recent AS (#{history.select(:value, :recorded_at).to_sql}),
        middle AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS m FROM recent)
        SELECT (SELECT count(*) FROM recent) AS readings,
               (SELECT count(DISTINCT value) FROM recent) AS distinct_values,
               (SELECT EXTRACT(EPOCH FROM max(recorded_at) - min(recorded_at)) FROM recent) AS span_seconds,
               (SELECT m FROM middle) AS middle,
               (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(value - (SELECT m FROM middle))) FROM recent) AS mad,
               (SELECT avg(abs(value - (SELECT m FROM middle))) FROM recent) AS average_deviation,
               (SELECT percentile_cont(0.05) WITHIN GROUP (ORDER BY value) FROM recent) AS low,
               (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY value) FROM recent) AS high
      SQL
    end

    def enough?(stats)
      stats["readings"].to_i >= MIN_READINGS && stats["distinct_values"].to_i >= MIN_DISTINCT &&
        stats["span_seconds"].to_f >= MIN_SPAN
    end

    # A sensor that never once read lower than the reading before it.
    def counter?
      falls = SensorReading.connection.select_value(<<~SQL.squish).to_i
        SELECT count(*) FROM (
          SELECT value, lag(value) OVER (ORDER BY recorded_at) AS before FROM (#{history.select(:value, :recorded_at).to_sql}) recent
        ) steps WHERE value < before
      SQL
      falls.zero?
    end
  end
end
