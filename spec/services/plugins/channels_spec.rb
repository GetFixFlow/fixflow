require "rails_helper"

# The fan-out: what the places that announce something (ChatNotifier.post) hand to the plugins' channels.
RSpec.describe Plugins::Channels do
  include ActiveJob::TestHelper

  let(:org) { create(:organization) }
  let(:other) { create(:organization) }
  let(:channel) { Plugins.channel("demo", "echo") }

  before do
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
    install_plugins("demo" => PluginHelpers::GOOD_PLUGIN)
  end

  def turn_on(organization, events: nil)
    Plugins::Settings.for(organization).set_enabled("demo", true)
    changes = { enabled: true, values: { address: "https://hooks.example.test/in" } }
    changes[:events] = events if events
    Plugins::Settings.for(organization.reload).update_channel(channel, changes)
  end

  def announce(organization = org,
               event: "wo_assigned")
    ChatNotifier.post(organization, event, title: "Assigned", body: "Pump 3",
  path: "/work-orders/12")
  end

  it "reaches a plugin channel through the one call every notification already makes" do
    turn_on(org)

    expect { announce }.to have_enqueued_job(PluginChannelJob).with(
      org.id, "demo", "echo", "wo_assigned", { title: "Assigned", body: "Pump 3", link: a_string_ending_with("/work-orders/12") }
    )
  end

  it "queues nothing for a company that has not switched the plugin on, however the channel is set up" do
    Plugins::Settings.for(org).update_channel(channel, enabled: true, values: { address: "https://hooks.example.test/in" })

    expect { announce }.not_to have_enqueued_job(PluginChannelJob)
  end

  it "queues nothing for a channel that is off, or for an event it did not tick" do
    turn_on(org, events: %w[iot_alert])
    expect { announce }.not_to have_enqueued_job(PluginChannelJob)
    expect { announce(event: "iot_alert") }.to have_enqueued_job(PluginChannelJob)

    Plugins::Settings.for(org.reload).update_channel(channel, enabled: false)
    expect { announce(event: "iot_alert") }.not_to have_enqueued_job(PluginChannelJob)
  end

  it "keeps the companies apart" do
    turn_on(org)

    expect { announce(other) }.not_to have_enqueued_job(PluginChannelJob)
  end

  it "leaves the chat channel as it was: both hear the event" do
    turn_on(org)
    org.chat_config.assign(kind: "slack", enabled: true, url: "https://hooks.slack.com/services/T000/B000/X").save_to(org)

    expect { announce }.to have_enqueued_job(ChatMessageJob).and have_enqueued_job(PluginChannelJob)
  end

  it "does not let a failure inside the plugin machinery break the notification" do
    turn_on(org)
    allow(Plugins).to receive(:installed).and_raise("registry exploded")
    allow(Rails.logger).to receive(:error)

    expect { announce }.not_to raise_error
  end

  it "does nothing when no plugin is installed" do
    Plugins.reset!

    expect { announce }.not_to have_enqueued_job(PluginChannelJob)
  end
end
