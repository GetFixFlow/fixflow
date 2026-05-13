require "rails_helper"

RSpec.describe Iot::RuleEvaluatorService do
  let(:org)   { create(:organization) }
  let(:asset) { create(:asset, organization: org) }

  # ─── check_threshold ───────────────────────────────────────────────────────

  describe ".check_threshold" do
    subject { described_class.check_threshold(rule, value) }

    context "gt operator" do
      let(:rule) { build(:iot_rule, operator: :gt, threshold: 80.0) }

      it "returns true when value is greater"  do
        expect(described_class.check_threshold(rule, 81.0)).to be true
      end

      it "returns false when value equals threshold" do
        expect(described_class.check_threshold(rule, 80.0)).to be false
      end

      it "returns false when value is less" do
        expect(described_class.check_threshold(rule, 79.0)).to be false
      end
    end

    context "lt operator" do
      let(:rule) { build(:iot_rule, operator: :lt, threshold: 20.0) }

      it "returns true when value is less"    { expect(described_class.check_threshold(rule, 19.0)).to be true }
      it "returns false when value is equal"  { expect(described_class.check_threshold(rule, 20.0)).to be false }
      it "returns false when value is greater" { expect(described_class.check_threshold(rule, 21.0)).to be false }
    end

    context "gte operator" do
      let(:rule) { build(:iot_rule, operator: :gte, threshold: 80.0) }

      it "returns true when value equals threshold" do
        expect(described_class.check_threshold(rule, 80.0)).to be true
      end

      it "returns true when value is greater" do
        expect(described_class.check_threshold(rule, 81.0)).to be true
      end

      it "returns false when value is less" do
        expect(described_class.check_threshold(rule, 79.0)).to be false
      end
    end

    context "lte operator" do
      let(:rule) { build(:iot_rule, operator: :lte, threshold: 20.0) }

      it "returns true when value equals threshold" { expect(described_class.check_threshold(rule, 20.0)).to be true }
      it "returns true when value is less"          { expect(described_class.check_threshold(rule, 19.0)).to be true }
      it "returns false when value is greater"      { expect(described_class.check_threshold(rule, 21.0)).to be false }
    end

    context "eq operator" do
      let(:rule) { build(:iot_rule, operator: :eq, threshold: 50.0) }

      it "returns true when value equals threshold"   { expect(described_class.check_threshold(rule, 50.0)).to be true }
      it "returns false when value differs"           { expect(described_class.check_threshold(rule, 50.1)).to be false }
    end

    context "outside_range operator" do
      let(:rule) { build(:iot_rule, :outside_range) }  # threshold: 10.0, threshold_max: 90.0

      it "returns true when value is below range"   { expect(described_class.check_threshold(rule, 9.9)).to be true }
      it "returns true when value is above range"   { expect(described_class.check_threshold(rule, 90.1)).to be true }
      it "returns false when value is within range" { expect(described_class.check_threshold(rule, 50.0)).to be false }
      it "returns false at lower bound"             { expect(described_class.check_threshold(rule, 10.0)).to be false }
      it "returns false at upper bound"             { expect(described_class.check_threshold(rule, 90.0)).to be false }
    end
  end

  # ─── handle_breach ─────────────────────────────────────────────────────────

  describe ".handle_breach" do
    let(:rule)    { create(:iot_rule, :no_cooldown, asset: asset, organization: org) }
    let(:reading) { create(:sensor_reading, asset: asset, organization: org, metric_name: rule.metric_name, value: 99.0) }

    it "creates an IoTAlert record" do
      expect { described_class.handle_breach(rule, reading) }.to change(IotAlert, :count).by(1)
    end

    it "increments rule trigger_count" do
      expect { described_class.handle_breach(rule, reading) }
        .to change { rule.reload.trigger_count }.by(1)
    end

    it "updates last_triggered_at" do
      described_class.handle_breach(rule, reading)
      expect(rule.reload.last_triggered_at).to be_within(2.seconds).of(Time.current)
    end

    context "when auto_create_wo is true" do
      it "creates a WorkOrder" do
        expect { described_class.handle_breach(rule, reading) }.to change(WorkOrder, :count).by(1)
      end

      it "links work order to the alert" do
        described_class.handle_breach(rule, reading)
        alert = IotAlert.last
        expect(alert.work_order_id).not_to be_nil
      end
    end

    context "when auto_create_wo is false" do
      let(:rule) { create(:iot_rule, :no_cooldown, :auto_wo_disabled, asset: asset, organization: org) }

      it "does not create a WorkOrder" do
        expect { described_class.handle_breach(rule, reading) }.not_to change(WorkOrder, :count)
      end
    end

    context "when on cooldown" do
      let(:rule) { create(:iot_rule, asset: asset, organization: org, last_wo_created_at: 30.minutes.ago, cooldown_minutes: 60) }

      it "skips creating an alert" do
        expect { described_class.handle_breach(rule, reading) }.not_to change(IotAlert, :count)
      end
    end

    context "when sustained_duration_seconds is set" do
      let(:rule) { create(:iot_rule, :no_cooldown, :with_sustained, asset: asset, organization: org) }

      it "sets breach_started_at on first call and does not create alert" do
        expect { described_class.handle_breach(rule, reading) }.not_to change(IotAlert, :count)
        expect(rule.reload.breach_started_at).not_to be_nil
      end

      it "creates alert once sustained duration has passed" do
        rule.update_columns(breach_started_at: 10.minutes.ago)
        expect { described_class.handle_breach(rule, reading) }.to change(IotAlert, :count).by(1)
      end
    end
  end

  # ─── generate_work_order ───────────────────────────────────────────────────

  describe ".generate_work_order" do
    let(:rule) do
      create(:iot_rule, :no_cooldown, asset: asset, organization: org,
        wo_title_template: "{asset_name} - High {metric_name} Alert",
        wo_description_template: "{metric_name} is {value} {unit}, threshold {threshold}")
    end
    let(:reading) { create(:sensor_reading, asset: asset, organization: org, metric_name: "temperature", value: 99.0, unit: "celsius") }
    let(:alert)   { create(:iot_alert, iot_rule: rule, asset: asset, sensor_reading: reading, metric_name: "temperature") }

    subject { described_class.generate_work_order(rule, reading, alert) }

    it "creates a WorkOrder" do
      expect { subject }.to change(WorkOrder, :count).by(1)
    end

    it "substitutes asset_name in title" do
      wo = subject
      expect(wo.title).to include(asset.name)
    end

    it "substitutes metric_name in title" do
      wo = subject
      expect(wo.title).to include("temperature")
    end

    it "substitutes value and unit in description" do
      wo = subject
      expect(wo.description).to include("99.0").and include("celsius")
    end

    it "sets iot_rule on the work order" do
      wo = subject
      expect(wo.iot_rule).to eq(rule)
    end
  end

  # ─── handle_clear ──────────────────────────────────────────────────────────

  describe ".handle_clear" do
    it "clears breach_started_at when set" do
      rule = create(:iot_rule, asset: asset, organization: org, breach_started_at: 5.minutes.ago)
      described_class.handle_clear(rule)
      expect(rule.reload.breach_started_at).to be_nil
    end

    it "is a no-op when breach_started_at is already nil" do
      rule = create(:iot_rule, asset: asset, organization: org)
      expect { described_class.handle_clear(rule) }.not_to raise_error
    end
  end
end
