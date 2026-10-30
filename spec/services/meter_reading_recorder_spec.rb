require "rails_helper"

RSpec.describe MeterReadingRecorder do
  let(:org)   { create(:organization) }
  let(:user)  { create(:user, organization: org) }
  let(:asset) { create(:asset, organization: org) }
  let(:meter) { create(:meter, organization: org, asset: asset, reading: 100, last_reading_at: 1.day.ago) }

  def record(value, **options) = described_class.call(meter, value: value, by: user, **options)

  it "keeps the reading and moves the meter to it" do
    reading = record("120.5", note: "Read off the display")

    expect(reading).to have_attributes(value: 120.5, recorded_by: user, note: "Read off the display", source: "manual")
    expect(meter.reload.reading).to eq(120.5)
    expect(meter.last_reading_at).to be_within(5.seconds).of(Time.current)
  end

  it "refuses a lower reading, because a meter only counts up, and keeps the old one" do
    expect { record(90) }.to raise_error(described_class::Rejected, /lower than the last reading, 100\.0 hours/)

    expect(meter.reload.reading).to eq(100)
    expect(meter.readings).to be_empty
  end

  it "accepts the same reading again" do
    expect(record(100)).to be_present
  end

  it "refuses what is not a number" do
    ["abc", "", nil, "Infinity", "NaN"].each do |value|
      expect { record(value) }.to raise_error(described_class::Rejected, /number/), "accepted #{value.inspect}"
    end
    expect { record(-5) }.to raise_error(described_class::Rejected)
    expect { record(10**13) }.to raise_error(described_class::Rejected)
  end

  context "when the meter was replaced" do
    let!(:pm) { create(:preventive_maintenance, :meter_based_pm, organization: org, asset: asset, meter: meter, frequency_value: 250) }

    it "takes a lower reading as a reset, and starts the schedules that follow it again from the new reading" do
      expect(pm.reload.next_due_reading).to eq(350)

      reading = record(5, reset: true, note: "New counter fitted")

      expect(reading.reset).to be(true)
      expect(meter.reload.reading).to eq(5)
      expect(pm.reload.next_due_reading).to eq(255)
    end
  end

  context "with a sensor" do
    def from_sensor(value, at: Time.current) = described_class.call(meter, value: value, at: at, source: :sensor)

    it "moves the meter up and keeps no more than one history line an hour" do
      expect(from_sensor(101)).to be_present
      expect(from_sensor(102, at: 1.minute.from_now)).to be_nil

      expect(meter.reload.reading).to eq(102)
      expect(meter.readings.sensor.count).to eq(1)
      expect(from_sensor(103, at: 2.hours.from_now)).to be_present
    end

    it "ignores a reading that is not higher, or older than the one the meter has" do
      expect(from_sensor(100)).to be_nil
      expect(from_sensor(50)).to be_nil
      expect(from_sensor(150, at: 3.days.ago)).to be_nil

      expect(meter.reload.reading).to eq(100)
    end
  end

  context "when it takes a schedule past its due reading" do
    let!(:pm) { create(:preventive_maintenance, :meter_based_pm, organization: org, asset: asset, meter: meter, frequency_value: 50) }

    it "makes the work order" do
      expect { record(150) }.to change(WorkOrder, :count).by(1)

      expect(WorkOrder.last).to have_attributes(preventive_maintenance_id: pm.id, asset_id: asset.id)
      expect(pm.reload.next_due_reading).to eq(200)
    end

    it "makes none before it is due" do
      expect { record(149) }.not_to change(WorkOrder, :count)
    end
  end
end
