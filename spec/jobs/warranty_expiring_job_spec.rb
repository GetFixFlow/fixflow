require "rails_helper"

RSpec.describe WarrantyExpiringJob, type: :job do
  include ActiveJob::TestHelper

  let(:org)     { create(:organization) }
  let(:today)   { Date.new(2026, 10, 16) }
  let!(:admin)  { create(:user, :admin, organization: org) }
  let!(:manager) { create(:user, :manager, organization: org) }

  around { |example| travel_to(today.in_time_zone) { example.run } }

  def asset(ends_on, **attrs) = create(:asset, organization: org, warranty_expires_on: ends_on, **attrs)

  def emails
    perform_enqueued_jobs
    ActionMailer::Base.deliveries
  end

  it "emails the managers and admins one list of the warranties that end within 30 days, soonest first" do
    asset(today + 30, name: "Chiller")
    asset(today, name: "Boiler")
    asset(today + 10, name: "Pump")
    create(:user, organization: org) # a technician is not told

    described_class.perform_now

    expect(emails.flat_map(&:to)).to contain_exactly(admin.email, manager.email)
    body = emails.first.body.to_s
    expect(body.scan(/Boiler|Pump|Chiller/)).to eq(%w[Boiler Pump Chiller])
    expect(emails.first.subject).to eq("[FixFlow] 3 warranties ending within 30 days")
  end

  it "leaves out warranties further away, already ended, not set, and on assets that are put away" do
    asset(today + 31)
    asset(today - 1)
    asset(nil)
    asset(today + 5, discarded_at: 1.day.ago)

    described_class.perform_now

    expect(emails).to be_empty
  end

  it "says each end date once, not every morning" do
    asset(today + 20)

    described_class.perform_now
    perform_enqueued_jobs
    ActionMailer::Base.deliveries.clear
    described_class.perform_now

    expect(emails).to be_empty
  end

  it "says it again when the date is changed" do
    warranty = asset(today + 20)
    described_class.perform_now
    perform_enqueued_jobs
    ActionMailer::Base.deliveries.clear

    warranty.update!(warranty_expires_on: today + 25)
    described_class.perform_now

    expect(emails.size).to eq(2) # the managers and the admin, once more
  end

  it "does not write a line in the audit log when it marks a warranty as announced" do
    warranty = asset(today + 20)

    expect { described_class.perform_now }.not_to(change { ActivityLog.where(resource_type: "Asset", resource_id: warranty.id).count })
    expect(warranty.reload.warranty_alerted_on).to eq(today + 20)
  end

  it "keeps companies apart" do
    other = create(:organization)
    create(:user, :manager, organization: other)
    asset(today + 3, name: "Ours")
    create(:asset, organization: other, warranty_expires_on: today + 3, name: "Theirs")

    described_class.perform_now

    mail = emails.find { |message| message.to.include?(manager.email) }
    expect(mail.body.to_s).to include("Ours")
    expect(mail.body.to_s).not_to include("Theirs")
    expect(emails.size).to eq(3)
  end

  it "does not email a manager who turned this email off" do
    asset(today + 3)
    manager.update!(notification_preferences: { "rules" => { "warranty_expiring" => { "email" => false } } })

    described_class.perform_now

    expect(emails.flat_map(&:to)).to eq([admin.email])
  end

  it "posts to the company's chat" do
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
    org.chat_config.assign(kind: "slack", enabled: true, url: "https://hooks.slack.com/services/T0/B0/X",
                           events: %w[warranty_expiring]).save_to(org)
    asset(today + 3, name: "Boiler")

    described_class.perform_now

    post = enqueued_jobs.find { |job| job["job_class"] == "ChatMessageJob" }["arguments"]
    expect(post[1..3]).to eq(["warranty_expiring", "1 warranty ending soon", "Boiler (2026-10-19)"])
  end
end
