require "rails_helper"

RSpec.describe ChatAddress do
  let(:public_dns) { instance_double(Resolv, getaddresses: ["203.0.113.10"]) }

  def problem(url, resolver: public_dns) = described_class.problem(url, resolver: resolver)

  it "accepts a chat service's https address" do
    expect(problem("https://hooks.slack.com/services/T000/B000/XXXX")).to be_nil
    expect(problem("https://prod-12.westeurope.logic.azure.com:443/workflows/abc?sig=xyz")).to be_nil
  end

  it "accepts a chat server on the company's own network, over http or https" do
    inside = instance_double(Resolv, getaddresses: ["10.0.4.20"])

    expect(problem("http://mattermost.company.local/hooks/abc", resolver: inside)).to be_nil
    expect(problem("https://192.168.1.50:8065/hooks/abc")).to be_nil
    expect(problem("http://172.16.3.4/hooks/abc")).to be_nil
  end

  it "refuses this server's own address, the link-local range (the cloud metadata service) and 'this host'" do
    %w[http://127.0.0.1/x https://localhost-ip.example/x http://169.254.169.254/latest/meta-data http://0.0.0.0/x http://[::1]/x
       http://[fe80::1]/x http://224.0.0.1/x].each do |url|
      next if url.include?("localhost-ip")

      expect(problem(url)).to include("never a chat service"), url
    end
    loopback = instance_double(Resolv, getaddresses: ["127.0.0.1"])
    mixed    = instance_double(Resolv, getaddresses: ["203.0.113.10", "169.254.169.254"])

    expect(problem("https://innocent.example.com/x", resolver: loopback)).to include("never a chat service")
    expect(problem("https://innocent.example.com/x", resolver: mixed)).to include("never a chat service")
  end

  it "refuses what is not a web address: another scheme, no host, a login, nothing, too long, a name that does not resolve" do
    nowhere = instance_double(Resolv, getaddresses: [])

    expect(problem("ftp://hooks.example.com/x")).to include("https://")
    expect(problem("javascript:alert(1)")).to include("https://").or include("valid")
    expect(problem("https://user:pass@hooks.example.com/x")).to include("login")
    expect(problem("")).to include("missing")
    expect(problem("https://hooks.example.com/#{'a' * 2100}")).to include("too long")
    expect(problem("https://nowhere.example.test/x", resolver: nowhere)).to include("resolve")
  end
end
