require "rails_helper"

RSpec.describe Iot::CleanupReadingsJob do
  let(:now) { Time.utc(2026, 10, 18, 2, 0) }
  let!(:org) { create(:organization, settings: { "iot_data_retention_days" => 30 }) }
  let(:pump) { create(:asset, organization: org) }

  around { |example| travel_to(now) { example.run } }

  it "removes old sensor data for the company, with no tenant set (as a job runs)" do
    old = create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 40.days)
    fresh = create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 1.day)
    ActsAsTenant.current_tenant = nil
    described_class.perform_now
    expect(SensorReading.unscoped.where(id: [old.id, fresh.id]).pluck(:id)).to eq([fresh.id])
  end

  it "uses the company setting, not IOT_RETENTION_DAYS" do
    stub_const("ENV", ENV.to_h.merge("IOT_RETENTION_DAYS" => "1"))
    reading = create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 10.days)
    described_class.perform_now
    expect(SensorReading.unscoped.where(id: reading.id)).to exist
  end

  it "does not fail on a reading that an alert points at, and still removes the others" do
    rule = create(:iot_rule, organization: org, asset: pump)
    evidence = create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 90.days)
    create(:iot_alert, iot_rule: rule, asset: pump, sensor_reading: evidence)
    old = create(:sensor_reading, organization: org, asset: pump, recorded_at: now - 90.days)
    expect { described_class.perform_now }.not_to raise_error
    expect(SensorReading.unscoped.where(id: [evidence.id, old.id]).pluck(:id)).to eq([evidence.id])
  end

  it "is scheduled every night at 02:00" do
    schedule = YAML.load_file(Rails.root.join("config/sidekiq.yml")).fetch(:scheduler).fetch(:schedule)
    expect(schedule.fetch("iot_cleanup")).to include(class: "Iot::CleanupReadingsJob", cron: "0 2 * * *")
    expect(described_class::RUNS_AT).to eq("02:00 UTC")
  end
end
