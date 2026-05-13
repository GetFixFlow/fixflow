require "rails_helper"

RSpec.describe Iot::AggregateReadingsJob, type: :job do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }

  let(:period_start) { Time.current.beginning_of_hour - 1.hour }
  let(:period_end)   { period_start + 1.hour }

  before do
    # Create 3 readings inside the target hour
    [10.0, 20.0, 30.0].each do |val|
      create(:sensor_reading,
        asset: asset, organization: org,
        metric_name: "temperature",
        value: val,
        recorded_at: period_start + 15.minutes)
    end
  end

  describe "#perform" do
    it "creates a SensorAggregate for each asset/metric pair" do
      travel_to(period_end + 1.second) do
        expect { described_class.new.perform }.to change(SensorAggregate, :count).by(1)
      end
    end

    it "calculates correct min/max/avg" do
      travel_to(period_end + 1.second) do
        described_class.new.perform
      end

      agg = SensorAggregate.last
      expect(agg.min_value.to_f).to eq(10.0)
      expect(agg.max_value.to_f).to eq(30.0)
      expect(agg.avg_value.to_f).to eq(20.0)
      expect(agg.reading_count).to eq(3)
    end

    it "is idempotent — running twice does not create duplicate aggregates" do
      travel_to(period_end + 1.second) do
        described_class.new.perform
        expect { described_class.new.perform }.not_to change(SensorAggregate, :count)
      end
    end

    it "does not include readings outside the previous hour" do
      create(:sensor_reading,
        asset: asset, organization: org,
        metric_name: "temperature",
        value: 999.0,
        recorded_at: period_start - 1.minute)  # outside window

      travel_to(period_end + 1.second) do
        described_class.new.perform
      end

      agg = SensorAggregate.last
      expect(agg.max_value.to_f).to eq(30.0)  # 999 not included
    end
  end
end
