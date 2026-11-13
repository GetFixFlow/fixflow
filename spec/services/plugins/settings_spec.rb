require "rails_helper"

RSpec.describe Plugins::Settings do
  let(:org) { create(:organization) }
  let(:settings) { described_class.for(org) }
  let(:channel) { Plugins.channel("demo", "echo") }

  before do
    install_plugins("demo" => PluginHelpers::GOOD_PLUGIN)
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"])
  end

  describe "switching a plugin on" do
    it "is off until an administrator switches it on, for that company only" do
      expect(settings.enabled?("demo")).to be(false)

      settings.set_enabled("demo", true)

      expect(described_class.for(org.reload).enabled?("demo")).to be(true)
      expect(described_class.for(create(:organization)).enabled?("demo")).to be(false)
      settings.set_enabled("demo", false)
      expect(described_class.for(org.reload).enabled?("demo")).to be(false)
    end
  end

  describe "setting up a channel" do
    def save(changes) = settings.update_channel(channel, changes)

    it "starts off, listening to every event" do
      state = settings.channel("demo", "echo")

      expect(state.enabled).to be(false)
      expect(state.events).to match_array(ChatConfig::EVENTS.keys)
      expect(state.active_for?("wo_assigned")).to be(false)
    end

    it "saves the values and which events it hears" do
      problems = save(enabled: true, events: %w[wo_assigned], values: { address: "https://hooks.example.test/in" })

      state = described_class.for(org.reload).channel("demo", "echo")
      expect(problems).to eq([])
      expect(state.active_for?("wo_assigned")).to be(true)
      expect(state.active_for?("iot_alert")).to be(false)
      expect(state.settings_for(channel)[:address]).to eq("https://hooks.example.test/in")
    end

    it "keeps a secret encrypted in the database, and hands it to the channel in the clear" do
      save(values: { address: "https://hooks.example.test/in", token: "tok-SECRET-123" })

      expect(org.reload.plugin_settings.to_json).not_to include("tok-SECRET-123")
      expect(described_class.for(org).channel("demo", "echo").settings_for(channel)[:token]).to eq("tok-SECRET-123")
    end

    it "keeps the saved secret when the form leaves it blank, and replaces it when a new one is typed" do
      save(values: { token: "first" })
      save(values: { token: "" })
      expect(settings.channel("demo", "echo").settings_for(channel)[:token]).to eq("first")

      save(values: { token: "second" })
      expect(described_class.for(org.reload).channel("demo", "echo").settings_for(channel)[:token]).to eq("second")
    end

    it "shows the screen the values, and only whether a secret is set" do
      save(values: { address: "https://hooks.example.test/in", token: "tok-SECRET-123" })

      shown = settings.channel("demo", "echo").to_screen(channel)
      expect(shown[:values]).to eq("address" => "https://hooks.example.test/in")
      expect(shown[:secrets_set]).to eq("token" => true)
      expect(shown.to_json).not_to include("tok-SECRET-123")
    end

    it "lets a half-filled channel be saved while it is off, and asks for what is missing once it is on" do
      expect(save(enabled: false, values: {})).to eq([])
      expect(save(enabled: true, values: {})).to eq(["Address is needed."])
    end

    it "refuses an address that points at the server itself, one that is not http(s), and one that is too long" do
      expect(save(values: { address: "http://127.0.0.1:3000/x" }).first).to match(/Address points at this server/)
      expect(save(values: { address: "ftp://hooks.example.test/x" }).first).to match(/Address must start with https/)
      expect(save(values: { address: "https://hooks.example.test/#{'a' * 600}" }).first).to match(/Address is too long/)
    end

    it "refuses an event FixFlow does not announce" do
      expect(save(events: %w[wo_assigned moon_landing])).to eq(["Unknown events: moon_landing."])
    end

    it "does not save anything when something is refused" do
      save(values: { address: "https://hooks.example.test/ok" })
      save(values: { address: "http://127.0.0.1/bad" })

      expect(described_class.for(org.reload).channel("demo", "echo").settings_for(channel)[:address]).to eq("https://hooks.example.test/ok")
    end

    it "ignores fields the channel does not have" do
      save(values: { address: "https://hooks.example.test/in", extra: "x" })

      expect(org.reload.plugin_settings.to_json).not_to include("extra")
    end

    it "empties a value that is sent blank, and falls back to the field's default" do
      mode = '{ key: "mode", kind: "select", options: %w[a b], default: "a" }'
      code = %(Plugins.define("opt") { title "O"; api 1; channel("chan", title: "C", fields: [#{mode}]) { |_m, _s| } })
      install_plugins("opt" => code)
      option_channel = Plugins.channel("opt", "chan")

      described_class.for(org).update_channel(option_channel, values: { mode: "b" })
      expect(described_class.for(org.reload).channel("opt", "chan").settings_for(option_channel)[:mode]).to eq("b")
      described_class.for(org).update_channel(option_channel, values: { mode: "" })
      expect(described_class.for(org.reload).channel("opt", "chan").settings_for(option_channel)[:mode]).to eq("a")
      expect(described_class.for(org).update_channel(option_channel, values: { mode: "z" })).to eq(["Mode must be one of: a, b."])
    end

    it "forgets a channel and its secrets" do
      save(enabled: true, values: { address: "https://hooks.example.test/in", token: "tok" })
      settings.forget_channel(channel)

      state = described_class.for(org.reload).channel("demo", "echo")
      expect(state.enabled).to be(false)
      expect(state.secret_set?(channel.field("token"))).to be(false)
    end

    it "keeps what was set up for a plugin that is taken away, ready for when it is put back" do
      save(values: { address: "https://hooks.example.test/in" })
      Plugins.reset!
      expect(org.reload.plugin_settings).to include("demo")

      install_plugins("demo" => PluginHelpers::GOOD_PLUGIN)
      expect(described_class.for(org).channel("demo", "echo").settings_for(Plugins.channel("demo", "echo"))[:address]).to eq("https://hooks.example.test/in")
    end
  end

  describe "#note (what happened last)" do
    it "records it without touching what the administrator set up" do
      save = settings.update_channel(channel, enabled: true, values: { address: "https://hooks.example.test/in", token: "tok" })
      expect(save).to eq([])

      settings.note(channel, last_error: "It could not be reached.")

      state = described_class.for(org.reload).channel("demo", "echo")
      expect(state).to have_attributes(enabled: true, last_error: "It could not be reached.")
      expect(state.settings_for(channel)).to include(address: "https://hooks.example.test/in", token: "tok")
    end

    it "does not undo a change made while a delivery was under way" do
      stale = described_class.for(Organization.find(org.id))
      settings.update_channel(channel, enabled: true, values: { address: "https://hooks.example.test/in" })
      settings.update_channel(channel, values: { address: "https://hooks.example.test/new" })

      stale.note(channel, last_sent_at: "2026-11-11T10:00:00Z")

      expect(described_class.for(org.reload).channel("demo", "echo").settings_for(channel)[:address]).to eq("https://hooks.example.test/new")
    end
  end
end
