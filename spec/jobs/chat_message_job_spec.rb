require "rails_helper"

RSpec.describe ChatMessageJob do
  let(:org)     { create(:organization) }
  let(:webhook) { "https://hooks.slack.com/services/T000/B000/SECRETPART" }
  let(:args)    { [org.id, "wo_assigned", "WO-000012 assigned to Ana", "Pump 3", "https://fixflow.example.com/work-orders/12"] }

  before do
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
    org.chat_config.assign(kind: "slack", enabled: true, url: webhook).save_to(org)
  end

  def last = org.reload.chat_config

  it "posts the message and remembers when it last got through" do
    sent = stub_request(:post, webhook).to_return(status: 200)

    described_class.perform_now(*args)

    expect(sent).to have_been_requested.once
    expect(last.last_sent_at).to be_present
    expect(last.last_error).to be_nil
  end

  it "clears an earlier error once a message gets through" do
    org.update!(chat_settings: org.chat_settings.merge("last_error" => "The chat service answered 500."))
    stub_request(:post, webhook).to_return(status: 200)

    described_class.perform_now(*args)

    expect(last.last_error).to be_nil
  end

  it "posts nothing when chat is off, the event is not ticked, or the address is gone" do
    stub = stub_request(:post, webhook)
    org.chat_config.assign(enabled: false).save_to(org)
    described_class.perform_now(*args)
    org.chat_config.assign(enabled: true, events: %w[iot_alert]).save_to(org)
    described_class.perform_now(*args)
    org.update!(chat_settings: {})
    described_class.perform_now(*args)

    expect(stub).not_to have_been_requested
  end

  it "does nothing for a company that no longer exists" do
    expect { described_class.perform_now(0, "wo_assigned", "x", "y", nil) }.not_to raise_error
  end

  it "keeps the reason, and does not try again, when the webhook refuses (revoked, mistyped)" do
    stub = stub_request(:post, webhook).to_return(status: 404)

    expect { described_class.perform_now(*args) }.not_to have_enqueued_job(described_class)

    expect(stub).to have_been_requested.once
    expect(last.last_error).to match(/does not know that webhook/)
    expect(last.last_error).not_to include("SECRETPART")
  end

  it "tries again later when the chat service is down" do
    stub_request(:post, webhook).to_return(status: 503)

    expect { described_class.perform_now(*args) }.to have_enqueued_job(described_class).with(*args)
  end

  it "keeps the reason after the last try fails" do
    stub_request(:post, webhook).to_return(status: 503)
    job = described_class.new(*args)
    # ActiveJob counts the tries at each kind of failure: this is the last one.
    job.exception_executions = { "[ChatDelivery::Unavailable]" => described_class::ATTEMPTS - 1 }

    job.perform_now

    expect(last.last_error).to eq("The chat service answered 503.")
  end

  it "drops the messages past twenty in a minute, so a channel is not buried by a noisy sensor" do
    allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)
    stub = stub_request(:post, webhook).to_return(status: 200)

    (described_class::PER_MINUTE + 5).times { described_class.perform_now(*args) }

    expect(stub).to have_been_requested.times(described_class::PER_MINUTE)
  end
end
