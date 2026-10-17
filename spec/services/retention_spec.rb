require "rails_helper"

RSpec.describe Retention do
  let(:org)   { create(:organization, settings: { "iot_data_retention_days" => 30 }) }
  let(:other) { create(:organization, settings: { "iot_data_retention_days" => 30 }) }
  let(:now)   { Time.utc(2026, 10, 18, 12, 0) }
  let(:pump)  { create(:asset, organization: org) }
  let(:other_pump) { create(:asset, organization: other) }

  def reading(asset, recorded_at) = create(:sensor_reading, organization: asset.organization, asset: asset, recorded_at: recorded_at)

  def summary(asset, period_start) = create(:sensor_aggregate, asset: asset, period_start: period_start)

  def system_lines = ActivityLog.unscoped.where(organization_id: org.id, user_id: nil)

  around { |example| travel_to(now) { example.run } }

  describe "sensor data" do
    it "removes readings and hourly summaries older than the company's setting, and keeps the rest" do
      old = [reading(pump, now - 31.days), reading(pump, now - 90.days)]
      kept = [reading(pump, now - 29.days), reading(pump, now - 1.hour)]
      old_summary = summary(pump, now - 40.days)
      kept_summary = summary(pump, now - 2.days)

      removed = described_class.new(org, now: now).sweep_sensor_data!

      expect(removed).to eq(readings: 2, summaries: 1)
      expect(SensorReading.unscoped.where(id: old.map(&:id))).to be_empty
      expect(SensorReading.unscoped.where(id: kept.map(&:id)).count).to eq(2)
      expect(SensorAggregate.where(id: old_summary.id)).to be_empty
      expect(SensorAggregate.where(id: kept_summary.id)).to exist
    end

    it "counts exactly 30 days as kept and a moment beyond as removed" do
      edge = reading(pump, now - 30.days)
      beyond = reading(pump, now - 30.days - 1.second)
      described_class.new(org, now: now).sweep_sensor_data!
      expect(SensorReading.unscoped.where(id: [edge.id, beyond.id]).pluck(:id)).to eq([edge.id])
    end

    it "keeps a reading that raised an alert, however old, and does not fail on it (the alert points at it)" do
      rule = create(:iot_rule, organization: org, asset: pump)
      evidence = reading(pump, now - 200.days)
      create(:iot_alert, iot_rule: rule, asset: pump, sensor_reading: evidence)
      plain = reading(pump, now - 200.days)

      expect { described_class.new(org, now: now).sweep_sensor_data! }.not_to raise_error
      expect(SensorReading.unscoped.where(id: [evidence.id, plain.id]).pluck(:id)).to eq([evidence.id])
    end

    it "does not touch another company's data" do
      theirs = reading(other_pump, now - 400.days)
      theirs_summary = summary(other_pump, now - 400.days)
      reading(pump, now - 400.days)
      described_class.new(org, now: now).sweep_sensor_data!
      expect(SensorReading.unscoped.where(id: theirs.id)).to exist
      expect(SensorAggregate.where(id: theirs_summary.id)).to exist
    end

    it "removes a large backlog in batches, all of it" do
      stub_const("Retention::BATCH", 2)
      5.times { |n| reading(pump, now - (40 + n).days) }
      expect(described_class.new(org, now: now).sweep_sensor_data![:readings]).to eq(5)
      expect(SensorReading.unscoped.where(organization_id: org.id)).to be_empty
    end

    it "follows the setting: a longer limit keeps more, a shorter one removes more" do
      reading(pump, now - 45.days)
      org.assign_company_settings("iot_data_retention_days" => 60)
      org.save!
      expect(described_class.new(org, now: now).sweep_sensor_data![:readings]).to eq(0)
      org.assign_company_settings("iot_data_retention_days" => 7)
      org.save!
      expect(described_class.new(org, now: now).sweep_sensor_data![:readings]).to eq(1)
    end

    it "writes one line by the system saying what was removed, and nothing when nothing was" do
      reading(pump, now - 50.days)
      summary(pump, now - 50.days)
      ActivityLog.unscoped.delete_all # the lines made by creating the asset above
      described_class.new(org, now: now).sweep_sensor_data!
      expect(system_lines.pluck(:action, :metadata)).to eq(
        [["retention.sensor_data_removed", { "readings" => 1, "summaries" => 1, "older_than_days" => 30 }]]
      )
      ActivityLog.unscoped.delete_all
      described_class.new(org, now: now).sweep_sensor_data!
      expect(system_lines).to be_empty
    end
  end

  describe "the audit log" do
    def line(at, org: self.org) = create(:activity_log, organization: org, user: nil, action: "asset.updated", created_at: at)

    it "is kept for ever by default" do
      line(now - 5000.days)
      expect(described_class.new(org, now: now).sweep_audit_log!).to eq(lines: 0)
      expect(ActivityLog.unscoped.where(organization_id: org.id).count).to eq(1)
    end

    it "removes lines older than the limit, keeps newer ones, and writes a line saying so" do
      org.assign_company_settings("audit_log_retention_days" => 365)
      org.save!
      old = line(now - 366.days)
      recent = line(now - 364.days)
      removed = described_class.new(org, now: now).sweep_audit_log!
      expect(removed).to eq(lines: 1)
      expect(ActivityLog.unscoped.where(id: [old.id, recent.id]).pluck(:id)).to eq([recent.id])
      summary_line = ActivityLog.unscoped.where(action: "retention.audit_log_removed").sole
      expect(summary_line.metadata).to eq("lines" => 1, "older_than_days" => 365)
    end

    it "does not touch another company's lines" do
      org.assign_company_settings("audit_log_retention_days" => 365)
      org.save!
      theirs = line(now - 900.days, org: other)
      described_class.new(org, now: now).sweep_audit_log!
      expect(ActivityLog.unscoped.where(id: theirs.id)).to exist
    end
  end
end
