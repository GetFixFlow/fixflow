require "rails_helper"

RSpec.describe WebhookAddress do
  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  it "takes an https address, and an http address on the company's own network" do
    expect(described_class.problem("https://hooks.example.test/in/abc")).to be_nil
    expect(described_class.problem("http://n8n.office.example.test:5678/webhook/x")).to be_nil
  end

  it "refuses what is not a web address, is missing, too long, or has a login in it" do
    expect(described_class.problem("")).to eq("is missing")
    expect(described_class.problem("ftp://example.test/x")).to match(/must start with https/)
    expect(described_class.problem("not a url")).to be_present
    expect(described_class.problem("https://#{'a' * 2100}.test")).to eq("is too long")
    expect(described_class.problem("https://user:pass@example.test/x")).to eq("must not contain a login")
  end

  it "refuses this server, link-local addresses (the cloud metadata service) and 'this host', as a name or a number" do
    %w[http://127.0.0.1/x http://localhost/x http://[::1]/x http://169.254.169.254/latest/meta-data http://0.0.0.0/x
       http://[fe80::1]/x].each do |url|
      allow(Resolv).to receive(:getaddresses).with("localhost").and_return(["127.0.0.1"])
      expect(described_class.problem(url)).to match(/points at this server/), url
    end
  end

  it "refuses a name that points at such an address, even among others" do
    allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10", "169.254.169.254"])

    expect(described_class.problem("https://sneaky.example.test/x")).to match(/points at this server/)
  end

  it "refuses a name that does not resolve" do
    allow(Resolv).to receive(:getaddresses).and_return([])

    expect(described_class.problem("https://nowhere.example.test/x")).to eq("does not resolve to an address")
  end

  it "allows an address inside the company network (a receiver in the office)" do
    expect(described_class.problem("http://10.1.2.3:5678/webhook")).to be_nil
    expect(described_class.problem("http://192.168.1.20/webhook")).to be_nil
  end
end
