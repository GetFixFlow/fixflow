require "rails_helper"

RSpec.describe AuditLogCleanupJob do
  let(:now) { Time.utc(2026, 10, 18, 2, 30) }
  let!(:org) { create(:organization, settings: { "audit_log_retention_days" => 365 }) }

  around { |example| travel_to(now) { example.run } }

  it "removes audit lines older than the company's limit" do
    old = create(:activity_log, organization: org, created_at: now - 400.days)
    fresh = create(:activity_log, organization: org, created_at: now - 10.days)
    described_class.perform_now
    expect(ActivityLog.unscoped.where(id: [old.id, fresh.id]).pluck(:id)).to eq([fresh.id])
  end

  it "removes nothing when the log is kept for ever (the default)" do
    org.assign_company_settings("audit_log_retention_days" => 0)
    org.save!
    old = create(:activity_log, organization: org, created_at: now - 4000.days)
    described_class.perform_now
    expect(ActivityLog.unscoped.where(id: old.id)).to exist
  end

  it "is scheduled every night at 02:30, after the sensor data is cleaned" do
    schedule = YAML.load_file(Rails.root.join("config/sidekiq.yml")).fetch(:scheduler).fetch(:schedule)
    expect(schedule.fetch("audit_log_cleanup")).to include(class: "AuditLogCleanupJob", cron: "30 2 * * *")
    expect(described_class::RUNS_AT).to eq("02:30 UTC")
  end
end
