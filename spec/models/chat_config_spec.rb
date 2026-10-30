require "rails_helper"

RSpec.describe ChatConfig do
  let(:org)     { create(:organization) }
  let(:webhook) { "https://hooks.slack.com/services/T000/B000/SECRETPART" }

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  def config(**changes) = org.chat_config.assign({ kind: "slack", enabled: true, url: webhook }.merge(changes))

  it "starts empty: off, nothing to post to, every event ticked" do
    empty = org.chat_config

    expect(empty).to have_attributes(enabled: false, kind: "slack", events: ChatConfig::EVENTS.keys)
    expect(empty.url_set?).to be(false)
    expect(empty.active_for?("wo_assigned")).to be(false)
  end

  it "is saved on the organization with the address encrypted, never in the clear" do
    config.save_to(org)

    raw = org.reload.chat_settings
    expect(raw.to_json).not_to include("SECRETPART")
    expect(raw["url_ciphertext"]).to be_present
    expect(org.chat_config.url).to eq(webhook)
    expect(org.chat_config).to have_attributes(kind: "slack", enabled: true)
  end

  it "keeps the saved address when the form leaves it blank, and replaces it when given a new one" do
    config.save_to(org)

    org.chat_config.assign(url: "", enabled: false).save_to(org)
    expect(org.reload.chat_config.url).to eq(webhook)

    org.chat_config.assign(url: "https://hooks.slack.com/services/T000/B000/OTHER").save_to(org)
    expect(org.reload.chat_config.url).to end_with("OTHER")
  end

  it "shows only the host of the address, enough to recognise it" do
    config.save_to(org)

    expect(org.reload.chat_config.url_hint).to eq("hooks.slack.com")
  end

  it "posts only the events that are ticked, and only while it is on" do
    config(events: %w[wo_assigned]).save_to(org)
    saved = org.reload.chat_config

    expect(saved.active_for?("wo_assigned")).to be(true)
    expect(saved.active_for?("iot_alert")).to be(false)
    saved.enabled = false
    expect(saved.active_for?("wo_assigned")).to be(false)
  end

  it "is not valid with an unknown kind or event, an unsafe address, or on with no address" do
    expect(config(kind: "irc")).not_to be_valid
    expect(config(events: %w[wo_assigned launch_missiles])).not_to be_valid
    expect(config(url: "http://169.254.169.254/latest")).not_to be_valid
    expect(org.chat_config.assign(enabled: true)).not_to be_valid
    expect(org.chat_config.assign(enabled: false)).to be_valid
    expect(config(kind: "teams")).to be_valid
  end

  it "cannot be read once SECRET_KEY_BASE changes, and is then without an address (to be entered again)" do
    config.save_to(org)
    allow(Rails.application).to receive(:key_generator).and_return(ActiveSupport::KeyGenerator.new("another" * 20))

    expect(org.reload.chat_config.url).to be_nil
    expect(org.chat_config.active_for?("wo_assigned")).to be(false)
  end
end
