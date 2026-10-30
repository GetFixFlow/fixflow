require "rails_helper"

RSpec.describe PushEndpoint do
  let(:public_dns)  { instance_double(Resolv, getaddresses: ["203.0.113.10"]) }

  def problem(endpoint, resolver: public_dns) = described_class.problem(endpoint, resolver: resolver)

  it "accepts an https address that resolves to the public internet" do
    expect(problem("https://fcm.googleapis.com/fcm/send/abc")).to be_nil
    expect(problem("https://updates.push.services.mozilla.com/wpush/v2/abc")).to be_nil
  end

  it "refuses anything but https" do
    expect(problem("http://fcm.googleapis.com/fcm/send/abc")).to include("https")
    expect(problem("ftp://push.example.test/x")).to include("https")
    expect(problem("javascript:alert(1)")).to include("https").or include("valid")
  end

  it "refuses an address that would send this server to something inside the network" do
    %w[https://127.0.0.1/x https://10.1.2.3/x https://192.168.0.5/x https://172.16.0.9/x https://169.254.169.254/latest/meta-data
       https://100.64.0.1/x https://[::1]/x https://[fd00::1]/x https://[fe80::1]/x https://0.0.0.0/x].each do |endpoint|
      expect(problem(endpoint)).to include("inside a network"), endpoint
    end
  end

  it "refuses a name that resolves to a private address, or to any private address among several" do
    inside = instance_double(Resolv, getaddresses: ["10.0.0.7"])
    mixed  = instance_double(Resolv, getaddresses: ["203.0.113.10", "169.254.169.254"])

    expect(problem("https://push.company.local/x", resolver: inside)).to include("inside a network")
    expect(problem("https://push.example.test/x", resolver: mixed)).to include("inside a network")
  end

  it "refuses a name that does not resolve, a login in the address, nothing, and something far too long" do
    nowhere = instance_double(Resolv, getaddresses: [])

    expect(problem("https://nowhere.example.test/x", resolver: nowhere)).to include("resolve")
    expect(problem("https://user:pw@fcm.googleapis.com/x")).to include("login")
    expect(problem("")).to include("missing")
    expect(problem("https://fcm.googleapis.com/#{'a' * 2100}")).to include("too long")
  end
end
