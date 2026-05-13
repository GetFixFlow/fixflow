require "rails_helper"

RSpec.describe Rack::Attack, type: :request do
  before do
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    Rack::Attack.reset!
  end

  after { Rack::Attack.reset! }

  describe "sign-in throttle" do
    it "allows up to 10 sign-in attempts per minute" do
      10.times do
        post "/api/v1/auth/sign_in",
          params: { user: { email: "x@x.com", password: "wrong" } }.to_json,
          headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "1.2.3.4" }
        expect(response.status).not_to eq(429)
      end
    end

    it "throttles the 11th sign-in attempt" do
      11.times do
        post "/api/v1/auth/sign_in",
          params: { user: { email: "x@x.com", password: "wrong" } }.to_json,
          headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "5.6.7.8" }
      end
      expect(response.status).to eq(429)
    end

    it "returns JSON with error code on throttle" do
      11.times do
        post "/api/v1/auth/sign_in",
          params: { user: { email: "x@x.com", password: "wrong" } }.to_json,
          headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "9.10.11.12" }
      end
      body = response.parsed_body
      expect(body.dig("error", "code")).to eq("RATE_LIMITED")
    end
  end

  describe "blocklist" do
    it "blocks IPs in BLOCKED_IPS env var" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("BLOCKED_IPS", "").and_return("99.99.99.99")

      get "/api/v1/health",
        headers: { "REMOTE_ADDR" => "99.99.99.99" }
      expect(response.status).to eq(403)
    end
  end
end
