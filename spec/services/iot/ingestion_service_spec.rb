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

    describe "looking for an unusual reading" do
      include ActiveJob::TestHelper

      let(:ai_on) { { "provider" => "local", "providers" => { "local" => { "base_url" => "http://192.168.1.20:11434/v1", "model" => "llama3" } } } }

      it "queues a look at each stored reading when the company has AI on" do
        org.update!(ai_settings: ai_on)

        expect { described_class.ingest(asset, [reading_data, reading_data.merge("value" => 73.0)], source: :rest_api) }
          .to have_enqueued_job(Iot::AnomalyCheckJob).exactly(2).times
      end

      it "queues nothing while AI is off, or once the company switched this feature off, or for a reading that was not stored" do
        org.update!(ai_settings: { "provider" => "none" })
        expect { described_class.ingest(asset, [reading_data], source: :rest_api) }.not_to have_enqueued_job(Iot::AnomalyCheckJob)

        org.update!(ai_settings: ai_on.merge("features" => { "anomalies" => false }))
        expect { described_class.ingest(asset, [reading_data], source: :rest_api) }.not_to have_enqueued_job(Iot::AnomalyCheckJob)

        org.update!(ai_settings: ai_on)
        expect { described_class.ingest(asset, [{ "metric" => "", "value" => nil }], source: :rest_api) }
          .not_to have_enqueued_job(Iot::AnomalyCheckJob)
      end

      it "still stores the reading when the check cannot be queued" do
        org.update!(ai_settings: ai_on)
        allow(Iot::AnomalyCheckJob).to receive(:perform_later).and_raise(Redis::CannotConnectError)

        result = described_class.ingest(asset, [reading_data], source: :rest_api)

        expect(result).to include(processed: 1, errors: [])
        expect(SensorReading.count).to eq(1)
      end
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

  describe "counting what a reading set off" do
    def hot(value) = [{ "metric" => "temperature", "value" => value, "unit" => "°C" }]

    it "reports the alert and the work order a breaching reading raised" do
      create(:iot_rule, asset: asset, organization: org, threshold: 85, auto_create_wo: true)

      result = described_class.ingest(asset, hot(91.3), source: :rest_api)

      expect(result).to include(received: 1, processed: 1, alerts_triggered: 1, work_orders_created: 1)
      expect(IotAlert.count).to eq(1)
    end

    it "reports an alert without a work order for a rule that makes none" do
      create(:iot_rule, :auto_wo_disabled, asset: asset, organization: org, threshold: 85)

      result = described_class.ingest(asset, hot(91.3), source: :rest_api)

      expect(result).to include(alerts_triggered: 1, work_orders_created: 0)
    end

    it "reports nothing for a reading that sets no rule off" do
      create(:iot_rule, asset: asset, organization: org, threshold: 85)

      result = described_class.ingest(asset, hot(70), source: :rest_api)

      expect(result).to include(processed: 1, alerts_triggered: 0, work_orders_created: 0)
    end

    it "counts one alert for each rule a reading sets off" do
      create(:iot_rule, asset: asset, organization: org, threshold: 85, name: "Hot")
      create(:iot_rule, asset: asset, organization: org, threshold: 90, name: "Very hot")

      result = described_class.ingest(asset, hot(95), source: :rest_api)

      expect(result).to include(alerts_triggered: 2, work_orders_created: 2)
    end

    it "raises no second alert while the rule is cooling down" do
      create(:iot_rule, asset: asset, organization: org, threshold: 85, cooldown_minutes: 30)
      described_class.ingest(asset, hot(91), source: :rest_api)

      result = described_class.ingest(asset, hot(93), source: :rest_api)

      expect(result).to include(processed: 1, alerts_triggered: 0, work_orders_created: 0)
    end

    it "reports the counts for a batch" do
      create(:iot_rule, asset: asset, organization: org, threshold: 85, cooldown_minutes: 0)

      result = described_class.ingest(asset, hot(91) + hot(93) + hot(70), source: :rest_api)

      expect(result).to include(received: 3, alerts_triggered: 2)
    end
  end
end
