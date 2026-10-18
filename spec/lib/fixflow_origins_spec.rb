require "rails_helper"
require "fixflow_origins"

RSpec.describe FixflowOrigins do
  it "lists APP_URL and everything in ALLOWED_ORIGINS, the way a browser writes an origin" do
    env = { "APP_URL" => "http://fixflow.example.com:8088/", "ALLOWED_ORIGINS" => " https://other.example.com/, http://localhost:5173 ,," }

    expect(described_class.from_env(env)).to eq(%w[http://fixflow.example.com:8088 https://other.example.com http://localhost:5173])
  end

  it "lists an address once, and copes with neither being set" do
    expect(described_class.from_env("APP_URL" => "http://a.test", "ALLOWED_ORIGINS" => "http://a.test/")).to eq(["http://a.test"])
    expect(described_class.from_env({})).to eq([])
  end
end
