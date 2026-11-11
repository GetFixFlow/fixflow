require "rails_helper"

RSpec.describe WebhookSender do
  let(:org) { create(:organization) }
  let(:webhook) { create(:webhook, organization: org, url: "https://hooks.example.test/in/abc") }
  let(:delivery) { Webhooks.ping(webhook) }

  before { allow(Resolv).to receive(:getaddresses).and_return(["203.0.113.10"]) }

  it "posts the message as JSON with headers that say what it is" do
    stub = stub_request(:post, "https://hooks.example.test/in/abc").to_return(status: 200, body: "ok")

    result = described_class.new(delivery).deliver

    expect(result).to have_attributes(ok: true, code: 200, excerpt: "ok", error: nil)
    expect(stub.with(headers: { "Content-Type" => "application/json", "User-Agent" => "FixFlow-Webhooks/1", "X-FixFlow-Event" => "ping",
                                "X-FixFlow-Delivery" => delivery.event_id, "X-FixFlow-Attempt" => "1" })).to have_been_requested
    expect(JSON.parse(delivery.body)).to include("event" => "ping", "id" => delivery.event_id)
  end

  it "signs the body with the webhook's secret, so the receiver can check it: t=<time>,v1=HMAC-SHA256(secret, '<time>.<body>')" do
    sent = nil
    stub_request(:post, "https://hooks.example.test/in/abc").to_return { |request|
      sent = request
      { status: 200 }
    }

    freeze_time do
      described_class.new(delivery).deliver

      time = Time.current.to_i
      expected = OpenSSL::HMAC.hexdigest("SHA256", webhook.secret, "#{time}.#{sent.body}")
      expect(sent.headers["X-Fixflow-Signature"]).to eq("t=#{time},v1=#{expected}")
    end
    expect(sent.body).to eq(delivery.body)
  end

  it "signs with a different secret once the secret is renewed" do
    sigs = []
    stub_request(:post, "https://hooks.example.test/in/abc").to_return { |request|
      sigs << request.headers["X-Fixflow-Signature"]
      { status: 200 }
    }

    freeze_time do
      described_class.new(delivery).deliver
      webhook.rotate_secret!
      described_class.new(delivery.reload).deliver
    end

    expect(sigs.uniq.size).to eq(2)
  end

  it "counts the attempt in the header" do
    delivery.update!(attempts: 2)
    stub = stub_request(:post, "https://hooks.example.test/in/abc").with(headers: { "X-FixFlow-Attempt" => "3" }).to_return(status: 200)

    described_class.new(delivery).deliver

    expect(stub).to have_been_requested
  end

  it "says what a refusing receiver answered, and notes a 410 Gone" do
    stub_request(:post, "https://hooks.example.test/in/abc").to_return(status: 500, body: "boom")
    expect(described_class.new(delivery).deliver).to have_attributes(ok: false, code: 500, excerpt: "boom",
error: "The receiver answered 500.", gone: false)

    stub_request(:post, "https://hooks.example.test/in/abc").to_return(status: 410)
    expect(described_class.new(delivery).deliver).to have_attributes(ok: false, code: 410, gone: true)
  end

  it "keeps only the start of a long answer" do
    stub_request(:post, "https://hooks.example.test/in/abc").to_return(status: 200, body: "x" * 5000)

    expect(described_class.new(delivery).deliver.excerpt.size).to eq(500)
  end

  it "does not follow a redirect: it is a reason to look at the address" do
    stub_request(:post, "https://hooks.example.test/in/abc").to_return(status: 302,
headers: { "Location" => "http://169.254.169.254/" })
    other = stub_request(:post, "http://169.254.169.254/")

    result = described_class.new(delivery).deliver

    expect(result).to have_attributes(ok: false, code: 302)
    expect(other).not_to have_been_requested
  end

  it "says so, without raising, when the receiver cannot be reached or is too slow" do
    stub_request(:post, "https://hooks.example.test/in/abc").to_timeout
    expect(described_class.new(delivery).deliver).to have_attributes(ok: false, code: nil, error: /Could not reach the receiver/)

    stub_request(:post, "https://hooks.example.test/in/abc").to_raise(Errno::ECONNREFUSED)
    expect(described_class.new(delivery).deliver).to have_attributes(ok: false, error: /Could not reach the receiver/)
  end

  it "checks the address again, and sends nothing to one that now points at this server" do
    stub = stub_request(:post, "https://hooks.example.test/in/abc")
    delivery # made while the name still pointed at a fine address
    allow(Resolv).to receive(:getaddresses).and_return(["127.0.0.1"])

    result = described_class.new(delivery).deliver

    expect(result.ok).to be(false)
    expect(result.error).to match(/points at this server/)
    expect(stub).not_to have_been_requested
  end

  it "connects to the address it checked, not to whatever the name says a moment later" do
    ips = []
    allow(Net::HTTP).to receive(:new).and_wrap_original do |original, *args|
      original.call(*args).tap { |http| allow(http).to receive(:ipaddr=) { |ip| ips << ip } }
    end
    stub_request(:post, "https://hooks.example.test/in/abc").to_return(status: 200)

    described_class.new(delivery).deliver

    expect(ips).to eq(["203.0.113.10"])
  end
end
