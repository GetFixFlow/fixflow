require "rails_helper"

RSpec.describe Iot::AnomalyDetector do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }
  let(:now)   { Time.zone.parse("2026-11-15 12:00") }

  # Readings every half hour for `hours` hours, ending two hours before `now`: a steady value with a gentle wobble (about 68 ±3).
  def load_history(hours: 72, metric: "temperature", quality: 0, &value)
    value ||= ->(n) { 68 + (n % 7) - 3 }
    count = hours * 2
    rows = (0...count).map do |n|
      { asset_id: asset.id, organization_id: org.id, metric_name: metric, value: value.call(n), unit: "°C", quality: quality, source: 1,
        raw_payload: {}, recorded_at: now - 2.hours - ((count - n) * 30).minutes, created_at: now, updated_at: now }
    end
    SensorReading.insert_all(rows) # rubocop:disable Rails/SkipsModelValidations -- hundreds of readings, quickly
  end

  def reading(value, metric: "temperature", at: now, quality: :good)
    create(:sensor_reading, asset: asset, organization: org, metric_name: metric, value: value, unit: "°C",
                            recorded_at: at, quality: quality)
  end

  def check(value, **options) = described_class.check(reading(value, **options), now: now)

  describe "a reading far outside what the sensor usually reads" do
    before { load_history }

    it "is flagged, with what was usual for that sensor and how many readings that was judged by" do
      anomaly = check(91.2)

      expect(anomaly).to be_persisted
      expect(anomaly).to have_attributes(
        organization_id: org.id, asset_id: asset.id, metric_name: "temperature", unit: "°C", status: "open",
        value: 91.2, usual_middle: 68, baseline_count: 144
      )
      expect(anomaly.usual_low).to be_between(64, 66)
      expect(anomaly.usual_high).to be_between(70, 72)
      expect(anomaly.score).to be > Iot::AnomalyDetector::SCORE
      expect(anomaly.message).to eq("temperature reads 91.2 °C; it is usually 65 to 71 °C")
    end

    it "is flagged just as well when it is far below" do
      expect(check(41.0)).to be_present
    end

    it "is not flagged for an ordinary reading, nor for the edge of the usual range" do
      expect(check(68.0)).to be_nil
      expect(check(71.5)).to be_nil
      expect(check(64.0)).to be_nil
      expect(SensorAnomaly.count).to eq(0)
    end

    it "is not flagged again for the same sensor within six hours, but is for another sensor, or later" do
      expect(check(91.2)).to be_present
      expect(check(93.0)).to be_nil

      load_history(metric: "pressure")
      expect(check(91.2, metric: "pressure")).to be_present
      later = now + 7.hours
      expect(described_class.check(reading(95.0, at: later), now: later)).to be_present
    end

    it "is still quiet about the same sensor two hours later" do
      expect(check(91.2)).to be_present
      later = now + 2.hours

      expect(described_class.check(reading(95.0, at: later), now: later)).to be_nil
    end
  end

  describe "when it has too little to judge by" do
    it "says nothing for a sensor with fewer than 60 readings" do
      load_history(hours: 29)

      expect(check(500.0)).to be_nil
    end

    it "says nothing when the readings do not reach back a whole day" do
      rows = (0...100).map do |n|
        { asset_id: asset.id, organization_id: org.id, metric_name: "temperature", value: 60 + (n % 9), source: 1, raw_payload: {},
          recorded_at: now - 2.hours - (n * 5).minutes, created_at: now, updated_at: now }
      end
      SensorReading.insert_all(rows) # rubocop:disable Rails/SkipsModelValidations -- hundreds of readings, quickly

      expect(check(500.0)).to be_nil
    end

    it "ignores a reading marked bad, in what it learns from and in what it judges" do
      load_history(quality: 2)

      expect(check(500.0)).to be_nil

      SensorReading.delete_all
      load_history
      expect(check(500.0, quality: :bad)).to be_nil
    end

    it "does not learn from readings older than two weeks" do
      load_history(hours: 72)
      SensorReading.update_all("recorded_at = recorded_at - interval '20 days'") # rubocop:disable Rails/SkipsModelValidations -- ages every reading

      expect(check(500.0)).to be_nil
    end
  end

  describe "the sensors it cannot judge" do
    it "leaves an on/off or status sensor alone" do
      load_history { |n| n.even? ? 0 : 1 }

      expect(check(1.0)).to be_nil
      expect(check(7.0)).to be_nil
    end

    it "leaves a counter that only goes up alone" do
      load_history { |n| 1000 + n }

      expect(check(5000.0)).to be_nil
    end

    it "leaves a sensor that feeds a meter alone" do
      create(:meter, :fed_by_sensor, organization: org, asset: asset).update!(sensor_metric: "temperature")
      load_history

      expect(check(500.0)).to be_nil
    end

    it "leaves an old reading being loaded in after the fact alone" do
      load_history

      expect(described_class.check(reading(500.0, at: now - 3.hours), now: now)).to be_nil
    end
  end

  describe "how far away is far" do
    before { load_history }

    it "is six typical deviations, the deviation being the median one scaled to match a standard deviation" do
      expect(check(83.0)).to be_nil  # 15 away: about 5 deviations of 2.97
      expect(check(87.0)).to be_present # 19 away: about 6.4
    end
  end

  describe "a sensor whose readings are steady" do
    it "is not flagged for a small change, since the deviation is never taken as less than 2% of the middle value" do
      load_history { |n| 20.0 + ((n % 11) * 0.0001) }

      expect(check(20.4)).to be_nil
      expect(check(26.0)).to be_present
    end

    it "uses the average deviation when most readings sit on the middle value" do
      load_history { |n| (n % 5).zero? ? (n % 7) * 0.5 : 0.0 }
      expect(SensorReading.where(value: 0).count).to be > 100

      expect(check(1.0)).to be_nil
      expect(check(40.0)).to be_present
    end
  end

  describe "learning" do
    it "learns from the sensor's own readings only, not another asset's or another metric's" do
      load_history(metric: "pressure") { |n| 900 + (n % 7) }

      expect(check(91.2)).to be_nil
    end

    it "learns from the latest readings when there are more than it uses" do
      stub_const("Iot::AnomalyDetector::BASELINE_MAX", 100)
      load_history(hours: 150) { |n| n < 150 ? 200 + (n % 7) : 68 + (n % 7) - 3 }

      anomaly = check(91.2)

      expect(anomaly.usual_middle).to eq(68)
      expect(anomaly.baseline_count).to eq(100)
    end

    it "does not count the reading being judged in what is usual" do
      load_history
      judged = reading(91.2)
      baseline = described_class.new(judged, now: now).send(:learn)

      expect(baseline.readings).to eq(144)
    end

    it "remembers what it learned for ten minutes, so a sensor that reports every second costs one look" do
      store = ActiveSupport::Cache::MemoryStore.new
      allow(Rails).to receive(:cache).and_return(store)
      load_history
      detector = described_class.new(reading(70.0), now: now)
      expect(SensorReading.connection).to receive(:select_one).once.and_call_original

      2.times { detector.check }
      described_class.check(reading(71.0), now: now)
    end

    it "remembers too that there was too little to judge by" do
      store = ActiveSupport::Cache::MemoryStore.new
      allow(Rails).to receive(:cache).and_return(store)
      expect(SensorReading.connection).to receive(:select_one).once.and_call_original

      2.times { described_class.check(reading(70.0), now: now) }
    end
  end
end
