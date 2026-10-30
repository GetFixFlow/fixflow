require "rails_helper"

RSpec.describe PushSubscription do
  let(:user)    { create(:user) }
  let(:browser) { fake_browser }

  def build(**attrs)
    described_class.new({ user: user, endpoint: browser.endpoint, p256dh: browser.p256dh,
  auth: browser.auth }.merge(attrs))
  end

  before { stub_push_dns }

  it "is valid with what a browser gives" do
    expect(build).to be_valid
  end

  it "needs all three parts, and a key and secret of the right size" do
    expect(build(endpoint: "")).not_to be_valid
    expect(build(p256dh: "")).not_to be_valid
    expect(build(auth: "")).not_to be_valid
    expect(build(p256dh: Base64.urlsafe_encode64("short"))).not_to be_valid
    expect(build(auth: Base64.urlsafe_encode64("x" * 32))).not_to be_valid
    expect(build(auth: "not base64 !!")).not_to be_valid
  end

  it "refuses an address inside the network (see PushEndpoint)" do
    subscription = build(endpoint: "https://10.0.0.5/push/abc")

    expect(subscription).not_to be_valid
    expect(subscription.errors[:endpoint].join).to include("inside a network")
  end

  it "keeps one row for an address" do
    build.save!

    expect(build(user: create(:user))).not_to be_valid
  end

  it "holds at most ten devices for a person" do
    described_class::MAX_PER_USER.times { build(endpoint: "https://push.example.test/#{SecureRandom.hex(6)}").save! }

    expect(build).not_to be_valid
    expect(build.tap(&:valid?).errors[:base].join).to include("10 devices")
  end

  it "goes with the person" do
    build.save!

    expect { user.destroy }.to change(described_class, :count).by(-1)
  end
end
