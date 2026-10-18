require "rails_helper"

# What the subscriber tells the health page while it listens (the reading of messages is covered with the ingestion).
RSpec.describe Iot::MqttSubscriberService do
  let(:client) { instance_double(MQTT::Client) }

  before do
    allow(Iot::MqttStatus).to receive_messages(connected!: nil, disconnected!: nil, message_received!: nil)
    allow(described_class).to receive(:process_message)
  end

  describe ".start_here?" do
    it "is the background worker, and only the worker, unless it is told otherwise" do
      expect(described_class.start_here?({}, worker: true)).to be(true)
      expect(described_class.start_here?({}, worker: false)).to be(false)
      expect(described_class.start_here?({ "MQTT_SUBSCRIBER" => "" }, worker: false)).to be(false)
    end

    it "does what MQTT_SUBSCRIBER says, whichever process this is" do
      expect(described_class.start_here?({ "MQTT_SUBSCRIBER" => "true" }, worker: false)).to be(true)
      expect(described_class.start_here?({ "MQTT_SUBSCRIBER" => " TRUE " }, worker: false)).to be(true)
      expect(described_class.start_here?({ "MQTT_SUBSCRIBER" => "false" }, worker: true)).to be(false)
    end

    it "asks Sidekiq whether this is the worker" do
      allow(Sidekiq).to receive(:server?).and_return(true)
      expect(described_class.start_here?({})).to be(true)
    end
  end

  describe ".listen" do
    it "says it is connected, notes each message, and says when it stops" do
      allow(client).to receive(:get).and_yield("fixflow/acme/telemetry", "{}").and_yield("fixflow/acme/telemetry", "{}")
      expect(Iot::MqttStatus).to receive(:connected!).at_least(:once)
      expect(Iot::MqttStatus).to receive(:message_received!).twice
      expect(described_class).to receive(:process_message).twice
      expect(Iot::MqttStatus).to receive(:disconnected!).once
      described_class.send(:listen, client)
    end

    it "says it has disconnected when the connection breaks, and lets the retry loop see the error" do
      allow(client).to receive(:get).and_raise(MQTT::ProtocolException, "broken pipe")
      expect(Iot::MqttStatus).to receive(:disconnected!).once
      expect { described_class.send(:listen, client) }.to raise_error(MQTT::ProtocolException)
    end

    it "leaves no renewal thread behind" do
      allow(client).to receive(:get)
      expect { described_class.send(:listen, client) }.not_to(change { Thread.list.size })
    end
  end

  describe ".stop" do
    it "says it has disconnected" do
      expect(Iot::MqttStatus).to receive(:disconnected!)
      described_class.stop
    end
  end
end
