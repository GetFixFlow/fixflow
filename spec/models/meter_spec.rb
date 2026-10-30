require "rails_helper"

RSpec.describe Meter, type: :model do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }

  it "needs a name and a unit, and a name is used once per asset" do
    create(:meter, organization: org, asset: asset, name: "Running hours")

    expect(build(:meter, organization: org, asset: asset, name: "running HOURS")).not_to be_valid
    expect(build(:meter, organization: org, asset: create(:asset, organization: org), name: "Running hours")).to be_valid
    expect(build(:meter, organization: org, asset: asset, name: " ")).not_to be_valid
    expect(build(:meter, organization: org, asset: asset, unit: "")).not_to be_valid
  end

  it "does not count down from nothing: a negative reading is refused" do
    expect(build(:meter, organization: org, asset: asset, reading: -1)).not_to be_valid
  end

  it "belongs to an asset of the same company" do
    other = create(:asset)

    expect(build(:meter, organization: org, asset: other)).not_to be_valid
  end

  it "lets one sensor metric feed only one meter of an asset, and treats an empty one as none" do
    create(:meter, :fed_by_sensor, organization: org, asset: asset)

    expect(build(:meter, :fed_by_sensor, organization: org, asset: asset)).not_to be_valid
    expect(build(:meter, organization: org, asset: asset, sensor_metric: "  ").tap(&:validate).sensor_metric).to be_nil
  end

  it "cannot be deleted while a maintenance schedule follows it" do
    pm = create(:preventive_maintenance, :meter_based_pm, organization: org, asset: asset)

    expect(pm.meter.destroy).to be(false)
    expect(pm.meter.errors).not_to be_empty
  end

  it "takes its readings with it when it is deleted" do
    meter = create(:meter, organization: org, asset: asset)
    create(:meter_reading, meter: meter)

    expect { meter.destroy }.to change(MeterReading, :count).by(-1)
  end
end
