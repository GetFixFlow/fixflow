require "rails_helper"

RSpec.describe WebhookCleanupJob do
  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  it "removes the record of messages older than 30 days, in every company, and keeps the rest" do
    hooks = [create(:webhook), create(:webhook)]
    old = hooks.map { |hook| Webhooks.ping(hook).tap { |d| d.update_columns(created_at: 31.days.ago) } } # rubocop:disable Rails/SkipsModelValidations
    recent = hooks.map { |hook| Webhooks.ping(hook).tap { |d| d.update_columns(created_at: 29.days.ago) } } # rubocop:disable Rails/SkipsModelValidations

    described_class.perform_now

    expect(WebhookDelivery.pluck(:id)).to match_array(recent.map(&:id))
    expect(WebhookDelivery.where(id: old.map(&:id))).to be_empty
  end

  it "is scheduled every night" do
    schedule = YAML.load_file(Rails.root.join("config/sidekiq.yml"), symbolize_names: false, permitted_classes: [Symbol])
    entry = schedule.fetch(:scheduler).fetch(:schedule).fetch("webhook_cleanup")

    expect(entry).to include(class: "WebhookCleanupJob", cron: "45 2 * * *")
  end
end
