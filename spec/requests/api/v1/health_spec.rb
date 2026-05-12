require "rails_helper"

RSpec.describe "GET /api/v1/health", type: :request do
  it "returns 200 with status ok" do
    get "/api/v1/health"
    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json["status"]).to eq("ok")
    expect(json["version"]).to eq("0.1.0")
    expect(json).to have_key("timestamp")
    expect(json).to have_key("database")
    expect(json).to have_key("redis")
  end
end
