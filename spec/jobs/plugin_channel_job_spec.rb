require "rails_helper"

RSpec.describe PluginChannelJob do
  let(:org) { create(:organization) }
  let(:channel) { Plugins.channel("demo", "echo") }
  let(:message) { { title: "WO-000012 assigned to Ana", body: "Pump 3", link: "https://fixflow.example.com/work-orders/12" } }
  let(:args) { [org.id, "demo", "echo", "wo_assigned", message] }

  before do
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
    install_plugins("demo" => PluginHelpers::GOOD_PLUGIN)
    Plugins::Settings.for(org).set_enabled("demo", true)
    Plugins::Settings.for(org.reload).update_channel(channel, enabled: true,
values: { address: "https://hooks.example.test/in", token: "tok-1" })
  end

  def state = Plugins::Settings.for(org.reload).channel("demo", "echo")

  it "gives the channel the message and its settings, secrets in the clear, and remembers when it last got through" do
    described_class.perform_now(*args)

    message, settings = PluginHelpers.deliveries.first
    expect(message).to have_attributes(event: "wo_assigned", title: "WO-000012 assigned to Ana", body: "Pump 3", company: org.name,
                                       link: "https://fixflow.example.com/work-orders/12")
    expect(settings).to include(address: "https://hooks.example.test/in", token: "tok-1")
    expect(state.last_sent_at).to be_present
    expect(state.last_error).to be_nil
  end

  it "clears an earlier error once a message gets through" do
    Plugins::Settings.for(org).note(channel, last_error: "It could not be reached.")

    described_class.perform_now(*args)

    expect(state.last_error).to be_nil
  end

  it "delivers nothing when the plugin is off for the company, the channel is off, or the event is not ticked" do
    Plugins::Settings.for(org).set_enabled("demo", false)
    described_class.perform_now(*args)
    Plugins::Settings.for(org.reload).set_enabled("demo", true)
    Plugins::Settings.for(org.reload).update_channel(channel, enabled: false)
    described_class.perform_now(*args)
    Plugins::Settings.for(org.reload).update_channel(channel, enabled: true, events: %w[iot_alert])
    described_class.perform_now(*args)

    expect(PluginHelpers.deliveries).to be_empty
  end

  it "does nothing for a company that no longer exists, or a plugin that has been taken away" do
    expect { described_class.perform_now(0, "demo", "echo", "wo_assigned", {}) }.not_to raise_error
    Plugins.reset!
    expect { described_class.perform_now(*args) }.not_to raise_error
    expect(PluginHelpers.deliveries).to be_empty
  end

  context "when the channel cannot deliver" do
    def plugin_raising(error)
      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN.sub("PluginHelpers.deliveries << [message, settings]", error))
      Plugins::Settings.for(org.reload).update_channel(Plugins.channel("demo", "echo"), enabled: true,
                                                       values: { address: "https://hooks.example.test/in" })
    end

    it "keeps the reason, and does not try again, when it is refused for good" do
      plugin_raising('raise Plugins::Refused, "The token was not accepted."')

      expect { described_class.perform_now(*args) }.not_to have_enqueued_job(described_class)

      expect(state.last_error).to eq("The token was not accepted.")
      expect(state.last_sent_at).to be_nil
    end

    it "tries again later when the service is down" do
      plugin_raising('raise Plugins::Unavailable, "The service answered 503."')

      expect { described_class.perform_now(*args) }.to have_enqueued_job(described_class).with(*args)
    end

    it "keeps the reason after the last try fails" do
      plugin_raising('raise Plugins::Unavailable, "The service answered 503."')
      job = described_class.new(*args)
      job.exception_executions = { "[Plugins::Unavailable]" => described_class::ATTEMPTS - 1 }

      job.perform_now

      expect(state.last_error).to eq("The service answered 503.")
    end

    it "treats the plugin's own crash as the plugin's fault, and says so without repeating its text" do
      plugin_raising('raise "secret detail"')
      allow(Rails.logger).to receive(:error)

      described_class.perform_now(*args)

      expect(state.last_error).to eq("The plugin failed (RuntimeError). The server log has the details.")
    end
  end

  it "drops the messages past twenty in a minute, so a channel is not buried by a noisy sensor" do
    allow(Rails).to receive(:cache).and_return(ActiveSupport::Cache::MemoryStore.new)

    (described_class::PER_MINUTE + 5).times { described_class.perform_now(*args) }

    expect(PluginHelpers.deliveries.size).to eq(described_class::PER_MINUTE)
  end
end
