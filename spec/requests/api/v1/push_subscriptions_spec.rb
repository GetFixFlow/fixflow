require "rails_helper"

RSpec.describe "Push subscriptions", type: :request do
  let(:org)     { create(:organization) }
  let(:user)    { create(:user, organization: org) }
  let(:browser) { fake_browser }
  let(:android_chrome) { "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36" }

  before { stub_push_dns }

  def subscribe(as: user, with: browser)
    post "/api/v1/push_subscriptions", params: { subscription: with.subscription_json }, as: :json,
                                       headers: auth_headers_for(as).merge("User-Agent" => android_chrome)
  end

  describe "GET /api/v1/push_subscriptions" do
    it "gives the server's public key (what the browser subscribes against) and this person's browsers, never stored by the browser" do
      subscribe
      get "/api/v1/push_subscriptions", headers: auth_headers_for(user)

      expect(response).to have_http_status(:ok)
      expect(response.headers["Cache-Control"]).to include("no-store")
      expect(json_body["public_key"]).to eq(PushKeys.public_key)
      expect(json_body["subscriptions"].pluck("endpoint")).to eq([browser.endpoint])
      expect(json_body["subscriptions"].first).to include("device")
    end

    it "does not show another person's browsers" do
      subscribe(as: create(:user, organization: org))
      get "/api/v1/push_subscriptions", headers: auth_headers_for(user)

      expect(json_body["subscriptions"]).to eq([])
    end

    it "needs a sign-in" do
      get "/api/v1/push_subscriptions"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/push_subscriptions" do
    it "saves the browser with what it said about itself" do
      expect { subscribe }.to change { user.push_subscriptions.count }.by(1)

      expect(response).to have_http_status(:created)
      row = user.push_subscriptions.last
      expect(row).to have_attributes(endpoint: browser.endpoint, p256dh: browser.p256dh, auth: browser.auth)
      expect(row.user_agent).to include("Chrome")
    end

    it "takes the same browser again without making a second row, and gives it to whoever is signed in on it now" do
      subscribe
      other = create(:user, organization: org)

      expect { subscribe(as: other) }.not_to change(PushSubscription, :count)

      expect(response).to have_http_status(:ok)
      expect(PushSubscription.find_by(endpoint: browser.endpoint).user).to eq(other)
    end

    it "refuses an address inside the network, so a signed-in person cannot point this server at it" do
      inside = browser.subscription_json.merge(endpoint: "https://169.254.169.254/x")
      post "/api/v1/push_subscriptions", params: { subscription: inside }, as: :json, headers: auth_headers_for(user)

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_body.dig("error", "message")).to include("inside a network")
      expect(PushSubscription.count).to eq(0)
    end

    it "refuses keys that are not keys, and a body that is not a subscription" do
      post "/api/v1/push_subscriptions", params: { subscription: browser.subscription_json.merge(keys: { p256dh: "x", auth: "y" }) },
                                         as: :json, headers: auth_headers_for(user)
      expect(response).to have_http_status(:unprocessable_content)

      post "/api/v1/push_subscriptions", params: { nothing: true }, as: :json, headers: auth_headers_for(user)
      expect(response).to have_http_status(:bad_request)
    end

    it "does not let a request choose whose browser it is, or the failure count" do
      stranger = create(:user, organization: org)
      crafted = browser.subscription_json.merge(user_id: stranger.id, failures: 9)
      post "/api/v1/push_subscriptions", params: { subscription: crafted }, as: :json, headers: auth_headers_for(user)

      expect(PushSubscription.find_by(endpoint: browser.endpoint)).to have_attributes(user_id: user.id, failures: 0)
    end
  end

  describe "DELETE /api/v1/push_subscriptions" do
    it "stops pushing to the browser named, and to no other" do
      other = fake_browser
      subscribe
      subscribe(with: other)

      delete "/api/v1/push_subscriptions", params: { endpoint: browser.endpoint }, headers: auth_headers_for(user)

      expect(response).to have_http_status(:no_content)
      expect(user.push_subscriptions.pluck(:endpoint)).to eq([other.endpoint])
    end

    it "cannot remove another person's browser" do
      stranger = create(:user, organization: org)
      subscribe(as: stranger)

      delete "/api/v1/push_subscriptions", params: { endpoint: browser.endpoint }, headers: auth_headers_for(user)

      expect(PushSubscription.find_by(endpoint: browser.endpoint)).to be_present
    end
  end

  describe "POST /api/v1/push_subscriptions/test" do
    it "sends a message to the person's browsers and says what happened" do
      subscribe
      sent = stub_request(:post, browser.endpoint).to_return(status: 201)

      post "/api/v1/push_subscriptions/test", headers: auth_headers_for(user)

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("sent" => 1, "removed" => 0, "failed" => 0)
      expect(sent).to have_been_requested.once
    end

    it "says so when a browser was gone, and forgets it" do
      subscribe
      stub_request(:post, browser.endpoint).to_return(status: 410)

      post "/api/v1/push_subscriptions/test", headers: auth_headers_for(user)

      expect(json_body).to eq("sent" => 0, "removed" => 1, "failed" => 0)
      expect(user.push_subscriptions).to be_empty
    end
  end
end
