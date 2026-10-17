require "rails_helper"

RSpec.describe Iot::MqttStatus do
  let(:redis) { Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0")) }

  before do
    redis.del(described_class::CONNECTED_KEY, described_class::LAST_MESSAGE_KEY)
    described_class.instance_variable_set(:@last_written, nil)
  end

  after { redis.del(described_class::CONNECTED_KEY, described_class::LAST_MESSAGE_KEY) }

  it "starts out not connected, with nothing heard" do
    expect(described_class.read).to eq(connected: false, last_message_at: nil)
  end

  it "is connected once the subscriber says so, and not after it says it has gone" do
    described_class.connected!
    expect(described_class.read[:connected]).to be(true)
    described_class.disconnected!
    expect(described_class.read[:connected]).to be(false)
  end

  it "forgets a connection by itself if the subscriber stops renewing it (the server died)" do
    described_class.connected!
    expect(redis.ttl(described_class::CONNECTED_KEY)).to be_between(1, described_class::CONNECTED_TTL)
  end

  it "remembers when the last message came" do
    travel_to(Time.utc(2026, 10, 17, 9, 30)) { described_class.message_received! }
    expect(described_class.read[:last_message_at]).to eq(Time.utc(2026, 10, 17, 9, 30))
  end

  it "does not write to Redis for every reading of a busy broker" do
    travel_to(Time.utc(2026, 10, 17, 9, 30)) { described_class.message_received! }
    travel_to(Time.utc(2026, 10, 17, 9, 45)) { described_class.message_received! }
    expect(described_class.read[:last_message_at]).to eq(Time.utc(2026, 10, 17, 9, 30))
  end

  it "never lets a Redis failure reach the code that receives readings" do
    allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError, "refused")
    expect { described_class.connected! }.not_to raise_error
    expect { described_class.message_received! }.not_to raise_error
    expect { described_class.disconnected! }.not_to raise_error
  end
end
