require "rails_helper"

RSpec.describe AiAddress do
  def resolver(*addresses) = Class.new { define_singleton_method(:getaddresses) { |_host| addresses } }

  def problem(kind, url, *addresses) = described_class.problem(kind, url, resolver: resolver(*addresses))

  describe "an OpenAI-compatible service" do
    it "may be an https address on the internet" do
      expect(problem("openai_compatible", "https://api.openai.com/v1", "203.0.113.10")).to be_nil
    end

    it "must be https, since the key and the work orders go over the internet" do
      expect(problem("openai_compatible", "http://api.example.com/v1", "203.0.113.10")).to eq("must start with https://")
    end

    it "may not be on a private network, and is pointed at the Local model choice instead" do
      %w[10.1.2.3 172.16.0.9 172.31.255.1 192.168.1.20 127.0.0.1 100.64.0.5 ::1 fd00::1].each do |address|
        expect(problem("openai_compatible", "https://ai.example.com/v1", address)).to include("Local model")
      end
    end

    it "may not have one address on the internet and another on a private network (a name that can be pointed inward)" do
      expect(problem("openai_compatible", "https://ai.example.com/v1", "203.0.113.10", "10.0.0.4")).to include("private network")
    end
  end

  describe "a local model" do
    it "may be on this server or a private network, over http or https" do
      %w[127.0.0.1 10.1.2.3 172.18.0.3 192.168.1.20 100.64.0.5 ::1 fd12::1].each do |address|
        expect(problem("local", "http://model.lan:11434/v1", address)).to be_nil
      end
      expect(problem("local", "https://model.lan/v1", "192.168.1.20")).to be_nil
    end

    it "may not be on the internet, because the point of it is that nothing leaves" do
      expect(problem("local", "http://203.0.113.10:11434/v1")).to include("would leave")
      expect(problem("local", "http://model.example.com/v1", "203.0.113.10")).to include("would leave")
    end

    it "may not have one address on a private network and another on the internet" do
      expect(problem("local", "http://model.example.com/v1", "192.168.1.20", "203.0.113.10")).to include("would leave")
    end

    it "sees through an IPv4 address written inside an IPv6 one" do
      expect(problem("local", "http://[::ffff:10.0.0.1]:11434/v1")).to be_nil
      expect(problem("local", "http://[::ffff:203.0.113.10]:11434/v1")).to include("would leave")
      expect(problem("local", "http://[::ffff:169.254.169.254]/v1")).to include("link-local")
    end
  end

  describe "either" do
    it "refuses the cloud metadata address and other places a server must not be sent" do
      %w[169.254.169.254 169.254.0.1 0.0.0.0 224.0.0.1 255.255.255.255 fe80::1 ff02::1 ::].each do |address|
        %w[local openai_compatible].each do |kind|
          expect(problem(kind, "https://x.example.com/v1", address)).to include("never an AI service")
        end
      end
    end

    it "refuses an address that is missing, too long, not a web address, or has a login, a query or a fragment" do
      expect(problem("local", "")).to eq("is missing")
      expect(problem("local", nil)).to eq("is missing")
      expect(problem("local", "http://a.lan/#{'x' * 2100}", "10.0.0.1")).to eq("is too long")
      expect(problem("local", "ftp://a.lan/v1", "10.0.0.1")).to eq("is not a valid address")
      expect(problem("local", "not a url")).to eq("is not a valid address")
      expect(problem("local", "http://user:pass@a.lan/v1", "10.0.0.1")).to eq("must not contain a login")
      expect(problem("local", "http://a.lan/v1?key=1", "10.0.0.1")).to eq("must not have a ? or # part")
      expect(problem("local", "http://a.lan/v1#top", "10.0.0.1")).to eq("must not have a ? or # part")
    end

    it "does not look a name up when told not to, but still judges an address written as numbers" do
      named = described_class.problem("local", "http://model.example.com/v1", resolver: resolver("203.0.113.10"), resolve: false)

      expect(named).to be_nil
      expect(described_class.problem("local", "http://203.0.113.10/v1", resolve: false)).to include("would leave")
      expect(described_class.problem("openai_compatible", "http://model.example.com/v1", resolve: false)).to eq("must start with https://")
    end

    it "refuses a name that does not resolve" do
      expect(problem("local", "http://nowhere.lan/v1")).to eq("does not resolve to an address")
    end
  end

  describe ".checked_addresses" do
    it "returns every address that was checked now, in the order to try them" do
      uri = URI.parse("http://model.lan:11434/v1/chat/completions")

      expect(described_class.checked_addresses("local", uri, resolver: resolver("192.168.1.20", "192.168.1.21")))
        .to eq(%w[192.168.1.20 192.168.1.21])
    end

    it "refuses when the name has started pointing somewhere it may not" do
      uri = URI.parse("http://model.lan:11434/v1/chat/completions")

      expect { described_class.checked_addresses("local", uri, resolver: resolver("203.0.113.10")) }
        .to raise_error(AiAddress::Refused, /would leave/)
      expect { described_class.checked_addresses("local", uri, resolver: resolver) }
        .to raise_error(AiAddress::Refused, /does not resolve/)
    end
  end
end
