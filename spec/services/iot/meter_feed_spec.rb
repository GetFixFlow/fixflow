require "rails_helper"

RSpec.describe "A sensor feeding a meter" do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }
  let!(:meter) { create(:meter, :fed_by_sensor, organization: org, asset: asset, reading: 100, unit: "hours") }

  def ingest(metric, value, at: Time.current)
    Iot::IngestionService.ingest(asset, [{ "metric" => metric, "value" => value, "timestamp" => at.iso8601 }], source: :rest_api)
  end

  it "moves the meter to what the sensor reports, for the metric it follows only" do
    ingest("running_hours", 130.5)
    ingest("temperature", 999)

    expect(meter.reload.reading).to eq(130.5)
  end

  it "makes a schedule that follows the meter fall due" do
    pm = create(:preventive_maintenance, :meter_based_pm, organization: org, asset: asset, meter: meter, frequency_value: 50)

    expect { ingest("running_hours", 160) }.to change(WorkOrder, :count).by(1)
    expect(pm.reload.times_generated).to eq(1)
  end

  it "still stores the reading when the meter cannot take it" do
    allow(MeterReadingRecorder).to receive(:call).and_raise("boom")

    results = ingest("running_hours", 140)

    expect(results[:processed]).to eq(1)
    expect(SensorReading.where(metric_name: "running_hours").count).to eq(1)
  end

  it "does not move a meter of another asset" do
    other = create(:meter, :fed_by_sensor, organization: org, reading: 5)

    ingest("running_hours", 140)

    expect(other.reload.reading).to eq(5)
  end
end
