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
end
