require "rails_helper"

RSpec.describe "GET /api/v1/health", type: :request do
  it "returns 200 with all check keys" do
    get "/api/v1/health", as: :json

    expect(response).to have_http_status(:ok).or have_http_status(:service_unavailable)
    body = response.parsed_body
    expect(body).to include("status", "version", "checks", "uptime_seconds", "timestamp")
    expect(body["checks"]).to include("database", "redis", "sidekiq", "storage")
  end

  it "returns the app version" do
    get "/api/v1/health", as: :json
    expect(response.parsed_body["version"]).to be_present
  end

  it "does not require authentication" do
    get "/api/v1/health"
    expect(response).not_to have_http_status(:unauthorized)
  end

  it "returns X-Request-ID header" do
    get "/api/v1/health"
    expect(response.headers["X-Request-ID"]).to be_present
  end

  it "reports database as ok when connected" do
    get "/api/v1/health", as: :json
    expect(response.parsed_body.dig("checks", "database", "status")).to eq("ok")
  end

  describe "when something is down" do
    let(:database_error) { PG::ConnectionBad.new("connection to db.internal.acme.test failed for user fixflow") }
    let(:redis_error) { Redis::CannotConnectError.new("cannot reach redis.internal.acme.test:6379") }

    # Anyone can read this endpoint, so it must say that a check failed without saying why: the reason can name
    # servers and users. The administrator's System Health page has the detail.
    it "does not tell the world why the database or Redis failed" do
      allow(ActiveRecord::Base.connection).to receive(:execute).and_raise(database_error)
      allow(Redis).to receive(:new).and_raise(redis_error)
      get "/api/v1/health", as: :json
      expect(response).to have_http_status(:service_unavailable)
      expect(response.body).not_to include("acme.test", "for user")
      failed = response.parsed_body["checks"].slice("database", "redis").values
      expect(failed).to all(include("status" => "error", "error" => "did not answer"))
    end

    it "still logs the reason for the people who run the server" do
      allow(Redis).to receive(:new).and_raise(redis_error)
      allow(Rails.logger).to receive(:warn)
      expect(Rails.logger).to receive(:warn).with(/\[health\] redis check failed: .*cannot reach redis.internal.acme.test/)
      get "/api/v1/health", as: :json
    end
  end
end
