require "rails_helper"

# A reading is a few hundred bytes. The broker refuses more than message_size_limit; FixFlow ignores more as well, for a
# message that reaches it another way.
RSpec.describe Iot::MqttSubscriberService, ".process_message" do
  before { create(:organization, subdomain: "acme") }

  it "ignores a message larger than the limit without reading it" do
    huge = %({"metric":"temp","value":1,"pad":"#{'x' * described_class::MAX_PAYLOAD_BYTES}"})
    expect(JSON).not_to receive(:parse)
    expect(Rails.logger).to receive(:warn).with(/Message too large/)

    described_class.process_message("fixflow/acme/telemetry", huge)
  end

  it "still reads one of a normal size" do
    expect(JSON).to receive(:parse).and_call_original

    described_class.process_message("fixflow/acme/telemetry", %({"metric":"temp","value":1}))
  end

  it "uses the same limit as the broker" do
    conf = Rails.root.join("config/mosquitto/mosquitto.conf").read

    expect(conf).to match(/^message_size_limit #{described_class::MAX_PAYLOAD_BYTES}$/)
  end
end
