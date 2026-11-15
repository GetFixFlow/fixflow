require "rails_helper"

RSpec.describe Iot::AnomalyCheckJob do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }
  let(:reading) { create(:sensor_reading, asset: asset, organization: org, value: 91.2) }
  let(:flagged) { build_stubbed(:sensor_anomaly, organization: org, asset: asset) }

  around do |example|
    saved = ENV.values_at("AI_ENABLED", "ANTHROPIC_API_KEY", "AI_MODEL")
    ENV["AI_ENABLED"] = "true"
    ENV["ANTHROPIC_API_KEY"] = "sk-test-key"
    ENV["AI_MODEL"] = ""
    example.run
  ensure
    ENV["AI_ENABLED"], ENV["ANTHROPIC_API_KEY"], ENV["AI_MODEL"] = saved
  end

  it "looks at the reading, and tells the chat channel when it was flagged" do
    allow(Iot::AnomalyDetector).to receive(:check).with(reading).and_return(flagged)
    expect(ChatNotifier).to receive(:post).with(
      org, "sensor_anomaly", title: "Unusual sensor reading: #{asset.name}", body: flagged.message, path: "/iot"
    )

    described_class.perform_now(reading.id)
  end

  it "stays quiet when nothing was flagged" do
    allow(Iot::AnomalyDetector).to receive(:check).and_return(nil)
    expect(ChatNotifier).not_to receive(:post)

    described_class.perform_now(reading.id)
  end

  it "does nothing for a reading that is gone" do
    expect(Iot::AnomalyDetector).not_to receive(:check)

    described_class.perform_now(0)
  end

  it "does nothing for a reading whose asset has been deleted since it was queued" do
    orphan = create(:sensor_reading, asset: asset, organization: org)
    allow(SensorReading).to receive(:unscoped).and_return(SensorReading.where(id: orphan.id))
    allow_any_instance_of(SensorReading).to receive(:asset).and_return(nil) # rubocop:disable RSpec/AnyInstance
    expect(Iot::AnomalyDetector).not_to receive(:check)

    expect { described_class.perform_now(orphan.id) }.not_to raise_error
  end

  it "does nothing when AI is off for the company, or this feature has been switched off" do
    expect(Iot::AnomalyDetector).not_to receive(:check)

    org.update!(ai_settings: { "provider" => "none" })
    described_class.perform_now(reading.id)
    org.update!(ai_settings: { "features" => { "anomalies" => false } })
    described_class.perform_now(reading.id)
  end
end
