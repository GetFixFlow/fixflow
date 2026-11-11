require "rails_helper"

RSpec.describe WebhookDeliveryJob do
  include ActiveJob::TestHelper

  let(:org) { create(:organization) }
  let(:webhook) { create(:webhook, organization: org) }
  let(:delivery) { Webhooks.ping(webhook).tap { |d| d.update!(event: "work_order.completed") } }
  let(:url) { "https://hooks.example.test/in/abc" }

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  it "delivers, and notes it" do
    stub_request(:post, url).to_return(status: 200, body: "thanks")

    described_class.perform_now(delivery.id)

    expect(delivery.reload).to have_attributes(status: "delivered", attempts: 1, response_code: 200, response_excerpt: "thanks",
error: nil)
    expect(delivery.delivered_at).to be_present
    expect(webhook.reload.last_delivery_at).to be_present
  end

  it "tries again later when the receiver does not take it, on the schedule: 1 minute, 5, 30, 2 hours, 6 hours" do
    stub_request(:post, url).to_return(status: 503)
    waits = []

    freeze_time do
      WebhookDelivery::RETRY_AFTER.each do |wait|
        expect { described_class.perform_now(delivery.id) }.to have_enqueued_job(described_class).with(delivery.id).at(wait.from_now)
        waits << (delivery.reload.next_attempt_at - Time.current).round
        expect(delivery.status).to eq("pending")
      end
    end

    expect(waits).to eq(WebhookDelivery::RETRY_AFTER.map(&:to_i))
    expect(delivery.attempts).to eq(5)
  end

  it "gives up after the sixth attempt, with what went wrong" do
    stub_request(:post, url).to_return(status: 503, body: "down for repairs")
    delivery.update!(attempts: 5)

    expect { described_class.perform_now(delivery.id) }.not_to have_enqueued_job(described_class)

    expect(delivery.reload).to have_attributes(status: "failed", attempts: 6, response_code: 503, error: "The receiver answered 503.",
next_attempt_at: nil)
    expect(webhook.reload.consecutive_failures).to eq(1)
  end

  it "stops at once for a receiver that says it is gone (410), and switches the webhook off" do
    stub_request(:post, url).to_return(status: 410)

    described_class.perform_now(delivery.id)

    expect(delivery.reload.status).to eq("failed")
    expect(webhook.reload).to have_attributes(enabled?: false, disabled_reason: /410 Gone/)
    expect(ActivityLog.where(action: "webhook.disabled")).to exist
  end

  it "switches a webhook off after ten messages in a row that gave up, and a success in between starts the count again" do
    webhook.update!(consecutive_failures: 9)
    stub_request(:post, url).to_return(status: 500)
    delivery.update!(attempts: 5)
    described_class.perform_now(delivery.id)
    expect(webhook.reload).to have_attributes(enabled?: false, consecutive_failures: 10)
    expect(webhook.disabled_reason).to match(/10 messages in a row/)

    webhook.enable!
    expect(webhook.reload).to have_attributes(enabled?: true, consecutive_failures: 0)

    webhook.update!(consecutive_failures: 5)
    stub_request(:post, url).to_return(status: 200)
    described_class.perform_now(Webhooks.ping(webhook).tap { |d| d.update!(event: "work_order.completed") }.id)
    expect(webhook.reload.consecutive_failures).to eq(0)
  end

  it "does not send to a webhook that was switched off, or removed, after the message was queued" do
    stub = stub_request(:post, url)
    webhook.disable!("test")

    described_class.perform_now(delivery.id)

    expect(delivery.reload).to have_attributes(status: "failed", error: /switched off/)
    expect(stub).not_to have_been_requested

    described_class.perform_now(0) # a delivery that is gone
  end

  it "does not send a message twice (a job running again for one that is done)" do
    stub = stub_request(:post, url).to_return(status: 200)

    2.times { described_class.perform_now(delivery.id) }

    expect(stub).to have_been_requested.once
  end

  it "counts an address that now points at this server as a failed attempt, and never calls it" do
    stub = stub_request(:post, url)
    delivery
    allow(Resolv).to receive(:getaddresses).and_return(["127.0.0.1"])

    described_class.perform_now(delivery.id)

    expect(delivery.reload).to have_attributes(status: "pending", attempts: 1, error: /points at this server/)
    expect(stub).not_to have_been_requested
  end
end
