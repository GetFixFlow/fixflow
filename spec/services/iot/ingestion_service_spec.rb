require "rails_helper"

RSpec.describe Iot::IngestionService do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }

  let(:reading_data) do
    { "metric" => "temperature", "value" => 72.4, "unit" => "celsius", "device_id" => "sensor-001" }
  end

  describe ".ingest" do
    it "creates a SensorReading record" do
      expect {
        described_class.ingest(asset, [reading_data], source: :rest_api)
      }.to change(SensorReading, :count).by(1)
    end

    it "returns a summary with received and processed counts" do
      result = described_class.ingest(asset, [reading_data], source: :rest_api)
      expect(result[:received]).to eq(1)
      expect(result[:processed]).to eq(1)
      expect(result[:errors]).to be_empty
    end

    it "calls RuleEvaluatorService for each reading" do
      expect(Iot::RuleEvaluatorService).to receive(:evaluate).once
      described_class.ingest(asset, [reading_data], source: :rest_api)
    end

    it "captures errors for invalid readings without raising" do
      bad_data = { "metric" => "", "value" => nil }
      result = described_class.ingest(asset, [bad_data], source: :rest_api)
      expect(result[:errors].size).to eq(1)
      expect(result[:processed]).to eq(0)
    end

    it "sets the correct source on the reading" do
      described_class.ingest(asset, [reading_data], source: :mqtt)
      reading = SensorReading.last
      expect(reading.source).to eq("mqtt")
    end
  end

  describe ".ingest_batch" do
    let(:asset2) { create(:asset, organization: org) }

    let(:batch) do
      [
        reading_data.merge("asset_id" => asset.id.to_s),
        { "asset_id" => asset2.id.to_s, "metric" => "vibration", "value" => 3.2, "unit" => "mm/s" }
      ]
    end

    it "creates SensorReadings for multiple assets" do
      expect {
        described_class.ingest_batch(org, batch, source: :rest_api)
      }.to change(SensorReading, :count).by(2)
    end

    it "handles unknown asset gracefully without raising" do
      bad_batch = [{ "asset_id" => "nonexistent-999", "metric" => "temp", "value" => 70.0 }]
      expect {
        result = described_class.ingest_batch(org, bad_batch, source: :rest_api)
        expect(result[:errors].size).to eq(1)
      }.not_to raise_error
    end

    it "aggregates processed counts across assets" do
      result = described_class.ingest_batch(org, batch, source: :rest_api)
      expect(result[:processed]).to eq(2)
    end
  end
end
