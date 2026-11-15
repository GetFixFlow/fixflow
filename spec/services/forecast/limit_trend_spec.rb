require "rails_helper"

RSpec.describe Forecast::LimitTrend do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }
  let(:now)   { Time.zone.parse("2026-11-15 12:00") }

  def rule(operator: :gt, threshold: 85, threshold_max: nil, metric: "temperature")
    create(:iot_rule, asset: asset, organization: org, metric_name: metric, operator: operator, threshold: threshold,
                      threshold_max: threshold_max, unit: "°C")
  end

  # Four readings a day for `days` days up to now: `start` rising by `per_day` a day, with a small wobble that does not trend.
  def load_readings(start: 60.0, per_day: 0.5, days: 30, metric: "temperature", quality: 0, per: 4, &value)
    value ||= ->(day, n) { start + (per_day * day) + ((((n * 7) % 5) - 2) * 0.2) }
    rows = (0...(days * per)).map do |n|
      day = n.fdiv(per)
      { asset_id: asset.id, organization_id: org.id, metric_name: metric, value: value.call(day, n), unit: "°C", quality: quality,
        source: 1, raw_payload: {}, recorded_at: now - ((days - day) * 24).hours, created_at: now, updated_at: now }
    end
    SensorReading.insert_all(rows) # rubocop:disable Rails/SkipsModelValidations -- hundreds of readings, quickly
  end

  def forecast(the_rule) = described_class.for_rule(the_rule, now: now)

  describe "a sensor on course for a limit that was set" do
    before { load_readings }

    it "says how long it has, with the range the data allow, and what it rests on" do
      result = forecast(rule)

      expect(result).to have_attributes(limit: 85, days_of_history: be >= 28, points: be >= 29)
      expect(result.current).to be_within(1.0).of(75.0)
      expect(result.slope_per_day).to be_within(0.05).of(0.5)
      expect(result.days_left).to be_within(2.5).of(20)
      expect(result.days_soonest).to be < result.days_left
      expect(result.days_latest).to be > result.days_left
      expect(result.r2).to be > 0.9
      expect(result).to be_rising
    end

    it "uses a rule's limit going down for a sensor that is falling" do
      SensorReading.delete_all
      load_readings(start: 100.0, per_day: -0.5)

      result = forecast(rule(operator: :lt, threshold: 80))

      expect(result.current).to be_within(1.0).of(85.0)
      expect(result.days_left).to be_within(3).of(10)
      expect(result).not_to be_rising
    end

    it "takes the end of a range that the sensor is moving towards" do
      up = forecast(rule(operator: :outside_range, threshold: 20, threshold_max: 85))
      SensorReading.delete_all
      load_readings(start: 100.0, per_day: -0.5)
      down = forecast(rule(operator: :outside_range, threshold: 70, threshold_max: 200))

      expect([up.limit, down.limit]).to eq([85, 70])
    end

    it "is a limit of at or above, or at or below, just the same" do
      expect(forecast(rule(operator: :gte, threshold: 85))).to be_present
    end

    it "says nothing about a limit it is moving away from, one it has reached, or one that is far off" do
      expect(forecast(rule(operator: :lt, threshold: 40))).to be_nil
      expect(forecast(rule(operator: :gt, threshold: 70))).to be_nil
      expect(forecast(rule(operator: :gt, threshold: 500))).to be_nil
    end

    it "says nothing for an equals rule, which has no side to approach" do
      expect(forecast(rule(operator: :eq, threshold: 85, threshold_max: 90))).to be_nil
    end

    it "says nothing for a sensor already past an above-limit and coming back down, nor one below a below-limit and coming back up" do
      SensorReading.delete_all
      load_readings(start: 100.0, per_day: -0.5)
      expect(forecast(rule(operator: :gt, threshold: 70))).to be_nil

      SensorReading.delete_all
      load_readings(start: 40.0, per_day: 0.5)
      expect(forecast(rule(operator: :lt, threshold: 70))).to be_nil
    end

    it "is not thrown by a few spikes, because each day is taken at its median" do
      SensorReading.where(recorded_at: (now - 10.days)..(now - 10.days + 1.hour)).update_all(value: 400) # rubocop:disable Rails/SkipsModelValidations -- spikes
      SensorReading.order(:recorded_at).limit(2).update_all(value: -300) # rubocop:disable Rails/SkipsModelValidations -- spikes

      expect(forecast(rule).days_left).to be_within(3).of(20)
    end

    it "ignores readings marked bad" do
      SensorReading.delete_all
      load_readings(quality: 2)

      expect(forecast(rule)).to be_nil
    end

    it "is for this metric only" do
      expect(forecast(rule(metric: "pressure"))).to be_nil
    end

    it "is for this asset only" do
      elsewhere = create(:asset, organization: org)
      other_rule = create(:iot_rule, asset: elsewhere, organization: org, metric_name: "temperature", operator: :gt, threshold: 85)

      expect(forecast(other_rule)).to be_nil
    end

    it "reads the line at this moment, counting each day at its middle" do
      SensorReading.delete_all
      load_readings(start: 10.0, per_day: 2.0)

      expect(forecast(rule(threshold: 100)).current).to be_within(0.5).of(70.0)
    end
  end

  describe "when there is nothing honest to say" do
    it "says nothing for a sensor that is not moving" do
      load_readings(per_day: 0.0)

      expect(forecast(rule)).to be_nil
    end

    it "says nothing for a sensor that only wobbles, however it happens to lean" do
      load_readings { |day, n| 70 + (Math.sin(n * 2.399) * 6) + (day * 0.01) }

      expect(forecast(rule)).to be_nil
    end

    it "says nothing for a trend that the line does not explain (it jumps about)" do
      load_readings { |day, n| 60 + (0.5 * day) + ((((n * 37) % 11) - 5) * 4.5) }

      expect(forecast(rule)).to be_nil
    end

    it "says nothing without two weeks of days to go by" do
      load_readings(days: 13)

      expect(forecast(rule)).to be_nil
    end

    it "does not count a day with fewer than three readings" do
      load_readings(days: 30, per: 2)

      expect(forecast(rule)).to be_nil
    end

    it "says nothing when the readings are all in a few days of the month" do
      rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].flat_map do |day|
        3.times.map do |n|
          { asset_id: asset.id, organization_id: org.id, metric_name: "temperature", value: 60 + day, source: 1, raw_payload: {},
            recorded_at: now - day.days + n.hours, created_at: now, updated_at: now }
        end
      end
      SensorReading.insert_all(rows) # rubocop:disable Rails/SkipsModelValidations -- fixture

      expect(forecast(rule)).to be_nil
    end

    it "does not look further back than thirty days, even for a trend that would reach its limit" do
      load_readings(start: 20.0, per_day: 1.0)
      SensorReading.update_all("recorded_at = recorded_at - interval '40 days'") # rubocop:disable Rails/SkipsModelValidations -- ages every reading

      expect(forecast(rule(threshold: 150))).to be_nil
    end

    it "does not look further back than thirty days" do
      load_readings(days: 30, start: 60)
      SensorReading.update_all("recorded_at = recorded_at - interval '40 days'") # rubocop:disable Rails/SkipsModelValidations -- ages every reading

      expect(forecast(rule)).to be_nil
    end
  end

  describe "remembering" do
    it "works a rule out once in ten minutes" do
      store = ActiveSupport::Cache::MemoryStore.new
      allow(Rails).to receive(:cache).and_return(store)
      load_readings
      the_rule = rule
      expect(SensorReading.connection).to receive(:select_one).once.and_call_original

      2.times { described_class.for_rule(the_rule, now: now) }
    end

    it "remembers that there was nothing to say" do
      store = ActiveSupport::Cache::MemoryStore.new
      allow(Rails).to receive(:cache).and_return(store)
      the_rule = rule
      expect(SensorReading.connection).to receive(:select_one).once.and_call_original

      2.times { expect(described_class.for_rule(the_rule, now: now)).to be_nil }
    end

    it "works it out again when the rule is changed" do
      store = ActiveSupport::Cache::MemoryStore.new
      allow(Rails).to receive(:cache).and_return(store)
      load_readings
      the_rule = rule
      first = described_class.for_rule(the_rule, now: now)
      travel_to(now + 1.minute) { the_rule.update!(threshold: 95) }

      expect(described_class.for_rule(the_rule.reload, now: now).days_left).to be > first.days_left
    end
  end
end
