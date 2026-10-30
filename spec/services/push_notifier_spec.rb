require "rails_helper"

RSpec.describe PushNotifier do
  let(:user)    { create(:user) }
  let(:browser) { fake_browser }
  let(:message) {
    described_class::Message.new(title: "Assigned to you: WO-000012", body: "Pump 3 is leaking", url: "/work-orders/12",
   tag: "wo_assigned")
  }
  let(:notifier) { described_class.new(vapid: PushKeys.vapid("APP_URL" => "https://fixflow.example.com")) }

  def subscribe(browser,
                to: user)
    PushSubscription.create!(user: to, endpoint: browser.endpoint, p256dh: browser.p256dh, auth: browser.auth)
  end

  before { stub_push_dns }

  it "sends a message only the browser it is for can read, signed by this server" do
    subscribe(browser)
    request = nil
    stub_request(:post, browser.endpoint).to_return { |req|
      request = req
      { status: 201 }
    }

    result = notifier.deliver(user, message)

    expect(result).to have_attributes(sent: 1, removed: 0, failed: 0)
    expect(JSON.parse(browser.decrypt(request.body))).to eq("title" => "Assigned to you: WO-000012", "body" => "Pump 3 is leaking",
                                                            "url" => "/work-orders/12", "tag" => "wo_assigned")
    expect(request.headers).to include("Content-Encoding" => "aes128gcm", "Urgency" => "normal")
    expect(request.headers["Ttl"].to_i).to eq(1.day.to_i)
  end

  it "signs with the server's own VAPID key, for the push service it is posting to, and says who is sending" do
    subscribe(browser)
    header = nil
    stub_request(:post, browser.endpoint).to_return { |req|
      header = req.headers["Authorization"]
      { status: 201 }
    }

    notifier.deliver(user, message)

    key = vapid_public_key(header)
    claims, = JWT.decode(header[/t=([^,]+)/, 1], key, true, algorithm: "ES256")
    expect(header[/k=([^,\s]+)/, 1]).to eq(PushKeys.public_key)
    expect(claims).to include("aud" => "https://push.example.test", "sub" => "https://fixflow.example.com")
    expect(claims["exp"]).to be_between(Time.current.to_i, 13.hours.from_now.to_i)
  end

  it "reaches every browser the person has on, and no one else's" do
    other = fake_browser
    stranger = fake_browser
    subscribe(browser)
    subscribe(other)
    subscribe(stranger, to: create(:user))
    stubs = [browser, other].map { |b| stub_request(:post, b.endpoint).to_return(status: 201) }
    not_asked = stub_request(:post, stranger.endpoint)

    expect(notifier.deliver(user, message).sent).to eq(2)
    expect(stubs).to all(have_been_requested.once)
    expect(not_asked).not_to have_been_requested
  end

  it "keeps a long message short enough for a push service" do
    subscribe(browser)
    request = nil
    stub_request(:post, browser.endpoint).to_return { |req|
      request = req
      { status: 201 }
    }
    long = described_class::Message.new(title: "T" * 500, body: "B" * 5000, url: "/x", tag: "t")

    notifier.deliver(user, long)

    sent = JSON.parse(browser.decrypt(request.body))
    expect(sent["title"].size).to be <= 100
    expect(sent["body"].size).to be <= 240
    expect(request.body.bytesize).to be < 4096
  end

  it "records a good send, and clears the count of failures" do
    subscription = subscribe(browser)
    subscription.update!(failures: 3)
    stub_request(:post, browser.endpoint).to_return(status: 201)

    notifier.deliver(user, message)

    expect(subscription.reload).to have_attributes(failures: 0)
    expect(subscription.last_sent_at).to be_within(5.seconds).of(Time.current)
  end

  {
    "gone (410), the person cancelled it" => 410,
    "unknown (404)" => 404,
    "refused as made under other keys (401)" => 401,
    "refused (403)" => 403
  }.each do |reason, status|
    it "removes a subscription the push service says is #{reason}" do
      subscribe(browser)
      stub_request(:post, browser.endpoint).to_return(status: status)

      expect(notifier.deliver(user, message)).to have_attributes(sent: 0, removed: 1, failed: 0)
      expect(user.push_subscriptions).to be_empty
    end
  end

  it "keeps a subscription through a push service that is having a bad moment, and removes it after five in a row" do
    subscription = subscribe(browser)
    stub_request(:post, browser.endpoint).to_return(status: 500)

    4.times { expect(notifier.deliver(user, message).failed).to eq(1) }
    expect(subscription.reload.failures).to eq(4)

    notifier.deliver(user, message)
    expect(PushSubscription.exists?(subscription.id)).to be(false)
  end

  it "keeps a subscription through a timeout, and sends to the others" do
    other = fake_browser
    subscribe(browser)
    subscribe(other)
    stub_request(:post, browser.endpoint).to_timeout
    stub_request(:post, other.endpoint).to_return(status: 201)

    expect(notifier.deliver(user, message)).to have_attributes(sent: 1, failed: 1)
    expect(user.push_subscriptions.count).to eq(2)
  end

  it "never posts to an address that is inside the network, even if one got stored, and removes it" do
    row = PushSubscription.new(user: user, endpoint: "https://169.254.169.254/latest/meta-data", p256dh: browser.p256dh,
auth: browser.auth)
    row.save!(validate: false)
    trap = stub_request(:any, /169\.254\.169\.254/)

    expect(notifier.deliver(user, message)).to have_attributes(sent: 0, removed: 1)
    expect(trap).not_to have_been_requested
    expect(PushSubscription.exists?(row.id)).to be(false)
  end
end
