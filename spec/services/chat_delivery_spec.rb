require "rails_helper"

RSpec.describe ChatDelivery do
  let(:org)     { create(:organization) }
  let(:webhook) { "https://hooks.slack.com/services/T000/B000/SECRETPART" }
  let(:content) { ChatMessage::Content.new(title: "WO-000012 assigned", body: "Pump 3", link: "https://fixflow.example.com/work-orders/12") }

  def config(kind: "slack", url: webhook) = ChatConfig.new(kind: kind, enabled: true, url: url)

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  it "posts the message as JSON to the webhook" do
    request = nil
    stub_request(:post, webhook).to_return { |req|
      request = req
      { status: 200, body: "ok" }
    }

    described_class.new(config).deliver(content)

    expect(request.headers["Content-Type"]).to eq("application/json")
    expect(JSON.parse(request.body)["text"]).to start_with("*WO-000012 assigned*")
  end

  it "posts the Adaptive Card form to a Teams webhook" do
    teams = "https://prod-12.westeurope.logic.azure.com/workflows/abc?sig=xyz"
    request = nil
    stub_request(:post, teams).to_return { |req|
      request = req
      { status: 202 }
    }

    described_class.new(config(kind: "teams", url: teams)).deliver(content)

    expect(JSON.parse(request.body)).to include("type" => "message")
    expect(JSON.parse(request.body).dig("attachments", 0, "contentType")).to eq("application/vnd.microsoft.card.adaptive")
  end

  it "counts any success (200 or 202) as sent" do
    stub_request(:post, webhook).to_return(status: 202)

    expect { described_class.new(config).deliver(content) }.not_to raise_error
  end

  {
    400 => /did not accept the message/,
    401 => /may have been revoked/,
    403 => /may have been revoked/,
    404 => /does not know that webhook/,
    410 => /does not know that webhook/
  }.each do |status, words|
    it "says in words that the chat service refused with #{status}, and that trying again will not help" do
      stub_request(:post, webhook).to_return(status: status)

      expect { described_class.new(config).deliver(content) }.to raise_error(described_class::Refused, words)
    end
  end

  it "treats 500, 503 and 429 as the service having a moment: worth trying again" do
    [500, 503, 429].each do |status|
      stub_request(:post, webhook).to_return(status: status)

      expect { described_class.new(config).deliver(content) }.to raise_error(described_class::Unavailable, /#{status}/)
    end
  end

  it "treats a timeout, a refused connection and a bad certificate as the service not being reachable" do
    [Net::OpenTimeout, Errno::ECONNREFUSED, OpenSSL::SSL::SSLError].each do |error|
      stub_request(:post, webhook).to_raise(error)

      expect { described_class.new(config).deliver(content) }.to raise_error(described_class::Unavailable, /could not be reached/)
    end
  end

  it "does not follow a redirect: it is a reason to look at the address, not to go where it says" do
    stub_request(:post, webhook).to_return(status: 302, headers: { "Location" => "http://169.254.169.254/latest/meta-data" })
    trap = stub_request(:any, /169\.254\.169\.254/)

    expect { described_class.new(config).deliver(content) }.to raise_error(described_class::Refused)
    expect(trap).not_to have_been_requested
  end

  it "checks the address again when it posts, and posts nothing to this server or a link-local address" do
    allow(Resolv).to receive(:getaddresses).and_return(["169.254.169.254"])
    trap = stub_request(:any, /./)

    expect { described_class.new(config).deliver(content) }.to raise_error(described_class::Refused, /never a chat service/)
    expect(trap).not_to have_been_requested
  end

  it "never puts the webhook address in an error message" do
    stub_request(:post, webhook).to_return(status: 404)

    expect { described_class.new(config).deliver(content) }.to(raise_error { |error|
      expect(error.message).not_to include("SECRETPART")
    })
  end
end
