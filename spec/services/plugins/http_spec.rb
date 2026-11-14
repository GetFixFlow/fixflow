require "rails_helper"

RSpec.describe Plugins::Http do
  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  it "posts what it is given, as FixFlow's plugin" do
    stub = stub_request(:post, "https://ntfy.example.test/topic")
           .with(body: "hello", headers: { "User-Agent" => "FixFlow-Plugin/1", "X-One" => "1" }).to_return(status: 200, body: "ok")

    response = described_class.post("https://ntfy.example.test/topic", body: "hello", headers: { "X-One" => 1 })

    expect(stub).to have_been_requested
    expect(response.code).to eq("200")
  end

  it "sends JSON when asked to" do
    stub = stub_request(:post, "https://ntfy.example.test/").with(body: { topic: "a", message: "héllo" }.to_json,
headers: { "Content-Type" => "application/json" })
                                                           .to_return(status: 200)

    described_class.post("https://ntfy.example.test/", json: true, body: { topic: "a", message: "héllo" })

    expect(stub).to have_been_requested
  end

  it "connects to the address it checked, not to whatever the name points at a moment later" do
    stub_request(:post, "https://ntfy.example.test/").to_return(status: 200)
    http = Net::HTTP.new("ntfy.example.test", 443)
    allow(Net::HTTP).to receive(:new).and_return(http)

    expect(http).to receive(:ipaddr=).with("203.0.113.10").and_call_original
    described_class.post("https://ntfy.example.test/")
  end

  describe "refuses to send" do
    it "to this server, a link-local or metadata address, and says why" do
      allow(Resolv).to receive(:getaddresses).with("sneaky.example.test").and_return(["127.0.0.1"]) # a name that points at this server
      %w[http://127.0.0.1/x http://169.254.169.254/latest http://[::1]/x http://sneaky.example.test/x].each do |address|
        expect {
          described_class.post(address)
        }.to raise_error(Plugins::Refused, "The address points at this server or a link-local address.")
      end
      expect(a_request(:any, /./)).not_to have_been_made
    end

    it "to an address that is not http or https" do
      expect { described_class.post("file:///etc/passwd") }.to raise_error(Plugins::Refused, /must start with https/)
    end
  end

  describe "tells a channel whether to try again" do
    it "later, when the service is down, slow or busy" do
      [500, 502, 503, 429].each do |code|
        stub_request(:post, "https://ntfy.example.test/").to_return(status: code)

        expect {
          described_class.post("https://ntfy.example.test/")
        }.to raise_error(Plugins::Unavailable, "The service answered #{code}.")
      end
    end

    it "never, when the service refuses the message" do
      stub_request(:post, "https://ntfy.example.test/").to_return(status: 401)
      expect {
        described_class.post("https://ntfy.example.test/")
      }.to raise_error(Plugins::Refused, /\(401\): the login or token was not accepted/)

      stub_request(:post, "https://ntfy.example.test/").to_return(status: 404)
      expect { described_class.post("https://ntfy.example.test/") }.to raise_error(Plugins::Refused, /does not know that address/)

      stub_request(:post, "https://ntfy.example.test/").to_return(status: 400)
      expect {
        described_class.post("https://ntfy.example.test/")
      }.to raise_error(Plugins::Refused, "The service refused the message (400).")
    end

    it "never follows a redirect (a redirect is a reason to look at the address)" do
      stub_request(:post, "https://ntfy.example.test/").to_return(status: 302, headers: { "Location" => "http://127.0.0.1/admin" })

      expect { described_class.post("https://ntfy.example.test/") }.to raise_error(Plugins::Refused, /\(302\)/)
      expect(a_request(:post, "http://127.0.0.1/admin")).not_to have_been_made
    end
  end
end
