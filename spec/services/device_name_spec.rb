require "rails_helper"

RSpec.describe DeviceName do
  {
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0.0.0 Safari/537.36" => "Chrome on macOS",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0" => "Edge on Windows",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0" => "Firefox on Windows",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.5 Safari/605.1.15" => "Safari on macOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1" => "Safari on iOS",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0.0.0 Mobile Safari/537.36" => "Chrome on Android",
    "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0" => "Firefox on Linux",
    "curl/8.7.1" => "Unknown device",
    "" => "Unknown device",
    nil => "Unknown device"
  }.each do |agent, name|
    it "calls #{agent.to_s[0, 60].inspect} #{name.inspect}" do
      expect(described_class.for(agent)).to eq(name)
    end
  end

  it "does not choke on very long or odd text" do
    expect(described_class.for(("x" * 100_000) + "\u0000\xFF".b.force_encoding("UTF-8"))).to eq("Unknown device")
  end
end
