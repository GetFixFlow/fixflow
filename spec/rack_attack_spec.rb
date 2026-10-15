require "rails_helper"

RSpec.describe Rack::Attack, type: :request do
  # Throttle counters must not leak into other specs: restore the original store afterwards.
  around do |example|
    original_store = Rack::Attack.cache.store
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    Rack::Attack.reset!
    begin
      example.run
    ensure
      Rack::Attack.reset!
      Rack::Attack.cache.store = original_store
    end
  end

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

  describe "public work request throttles" do
    def report_from(ip)
      post "/api/v1/work_requests", params: { work_request: { requester_name: "A" } }, as: :json,
                                    headers: { "REMOTE_ADDR" => ip }
    end

    def look_up_from(ip, path = "/api/v1/work_requests/#{'a' * 22}")
      get path, headers: { "REMOTE_ADDR" => ip }
    end

    it "lets one address send 5 reports in 10 minutes and answers the 6th with 429" do
      5.times do
        report_from("10.0.0.1")
        expect(response.status).not_to eq(429)
      end

      report_from("10.0.0.1")

      expect(response).to have_http_status(:too_many_requests)
      expect(response.parsed_body.dig("error", "code")).to eq("RATE_LIMITED")
      expect(response.headers["Retry-After"]).to eq("600")
    end

    it "counts reports that fail validation too, so guessing cannot be free" do
      6.times { report_from("10.0.0.2") }

      expect(response).to have_http_status(:too_many_requests)
    end

    it "does not hold one address's reports against another" do
      6.times { report_from("10.0.0.3") }
      report_from("10.0.0.4")

      expect(response.status).not_to eq(429)
    end

    it "allows 20 reports a day from one address, whatever the pace" do
      4.times do |round|
        5.times do
          report_from("10.0.0.5")
          expect(response.status).not_to eq(429), "report #{round * 5} was throttled"
        end
        travel 11.minutes
      end

      report_from("10.0.0.5")

      expect(response).to have_http_status(:too_many_requests)
    end

    it "caps all addresses together at 60 reports an hour, so a spread-out flood cannot fill the inboxes" do
      60.times do |n|
        report_from("10.1.#{n / 250}.#{(n % 250) + 1}")
        expect(response.status).not_to eq(429), "report #{n} was throttled"
      end

      report_from("10.9.9.9")

      expect(response).to have_http_status(:too_many_requests)
    end

    it "limits looking up links and equipment codes to 60 in 5 minutes per address (it is guessing)" do
      60.times do |n|
        look_up_from("10.0.1.1", n.even? ? "/api/v1/work_requests/#{'a' * 22}" : "/api/v1/public_assets/#{'b' * 24}")
        expect(response.status).not_to eq(429), "lookup #{n} was throttled"
      end

      look_up_from("10.0.1.1")
      expect(response).to have_http_status(:too_many_requests)

      look_up_from("10.0.1.2")
      expect(response.status).not_to eq(429)
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
