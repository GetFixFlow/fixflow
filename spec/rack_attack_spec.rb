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

  describe "AI throttle" do
    let(:admin) { create(:user, :admin) }
    let(:headers) { auth_headers_for(admin) } # the throttle counts per sign-in, so the same one is used throughout

    it "counts the assistant, a suggested priority and the AI settings' try-it button (each costs a model call), 5 a minute together" do
      allow(Ai::Client).to receive(:chat).and_return('{"priority":"low","reason":"x"}')
      5.times do |n|
        path = %w[/api/v1/ai/priority /api/v1/ai/work_order_draft /api/v1/ai_settings/test].fetch(n % 3)
        post path, params: { ai: { provider: "none" }, title: "x" }, as: :json, headers: headers
        expect(response).not_to have_http_status(:too_many_requests)
      end

      post "/api/v1/ai_settings/test", params: { ai: { provider: "none" } }, as: :json, headers: headers
      expect(response).to have_http_status(:too_many_requests)
      post "/api/v1/ai/priority", params: { title: "x" }, headers: headers
      expect(response).to have_http_status(:too_many_requests)
      post "/api/v1/ai/assist", params: { work_order_id: 0, message: "hi" }, headers: headers
      expect(response).to have_http_status(:too_many_requests)
    end

    it "counts a draft work order too" do
      5.times { post "/api/v1/ai/work_order_draft", params: { other: "x" }, headers: headers }

      post "/api/v1/ai/work_order_draft", params: { text: "pump on line 3 is leaking oil" }, headers: headers
      expect(response).to have_http_status(:too_many_requests)
    end

    it "does not count asking whether AI is on, nor reading and saving the settings, which cost nothing" do
      12.times do
        get "/api/v1/ai/config", headers: headers
        expect(response).to have_http_status(:ok)
        get "/api/v1/ai/forecasts/parts", headers: headers
        expect(response).not_to have_http_status(:too_many_requests)
        get "/api/v1/ai_settings", headers: headers
        expect(response).to have_http_status(:ok)
      end
      patch "/api/v1/ai_settings", params: { ai: { provider: "none" } }, as: :json, headers: headers
      expect(response).to have_http_status(:ok)
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

  # The security review before 1.0: a route answers more than one spelling of its address, so a limit has to as well.
  describe "limits that cannot be walked round" do
    describe ".route_path" do
      def route_path(path) = described_class.route_path(Rack::Attack::Request.new(Rack::MockRequest.env_for("/", "PATH_INFO" => path)))

      it "reads an address as the router does: without a format, a trailing slash or doubled slashes" do
        expect(route_path("/api/v1/auth/sign_in")).to eq("/api/v1/auth/sign_in")
        expect(route_path("/api/v1/auth/sign_in.json")).to eq("/api/v1/auth/sign_in")
        expect(route_path("/api/v1/auth/sign_in/")).to eq("/api/v1/auth/sign_in")
        expect(route_path("//api/v1//auth/sign_in")).to eq("/api/v1/auth/sign_in")
        expect(route_path("/api/v1/work_requests/abc123.json")).to eq("/api/v1/work_requests/abc123")
      end
    end

    def sign_in_attempt(path, ip)
      post path, params: { user: { email: "x@x.com", password: "wrong" } }.to_json,
                 headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => ip }
      response.status
    end

    it "counts sign-ins sent to /sign_in.json, /sign_in/ and //sign_in with the others" do
      paths = ["/api/v1/auth/sign_in", "/api/v1/auth/sign_in.json", "/api/v1/auth/sign_in/", "//api/v1/auth/sign_in"]
      statuses = 12.times.map { |i| sign_in_attempt(paths[i % paths.size], "21.1.1.1") }

      expect(statuses.first(10)).to all(be_in([401, 404]))
      expect(statuses.last(2)).to all(eq(429))
    end

    it "counts public work requests sent as /work_requests.json" do
      statuses = 7.times.map do |i|
        post(i.even? ? "/api/v1/work_requests.json" : "/api/v1/work_requests", params: {}.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "22.2.2.2" })
        response.status
      end

      expect(statuses.last(2)).to all(eq(429)) # the limit is five in ten minutes
    end

    it "counts password-reset requests sent as /password.json" do
      statuses = 7.times.map do
        post "/api/v1/auth/password.json", params: { user: { email: "x@x.com" } }.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "23.3.3.3" }
        response.status
      end

      expect(statuses.last(2)).to all(eq(429))
    end

    it "counts a caller's AI requests by their token, not by the whole header (extra words do not make a new caller)" do
      statuses = 8.times.map do |i|
        post "/api/v1/ai/assist", params: {}.to_json,
             headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "24.4.4.4",
                        "Authorization" => "Bearer same.token.here #{'x' * i}" }
        response.status
      end

      expect(statuses.last(2)).to all(eq(429)) # the limit is five a minute
    end

    it "counts password-change guesses by the token as well" do
      statuses = 8.times.map do |i|
        patch "/api/v1/profile/password", params: {}.to_json,
              headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "25.5.5.5",
                         "Authorization" => "Bearer same.token.here pad#{i}" }
        response.status
      end

      expect(statuses.last(2)).to all(eq(429))
    end

    it "does not keep the full IoT API key in the cache" do
      key = "fxk_#{'a' * 40}"
      post "/api/v1/iot/ingest", params: {}.to_json, headers: { "Content-Type" => "application/json", "X-API-Key" => key }

      keys = Rack::Attack.cache.store.instance_variable_get(:@data).keys
      expect(keys.join).not_to include(key)
    end
  end
end
