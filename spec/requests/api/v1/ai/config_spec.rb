require "rails_helper"

RSpec.describe "Api::V1::Ai::Config", type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization, role: "technician") }

  around do |example|
    saved = ENV.values_at("AI_ENABLED", "ANTHROPIC_API_KEY", "AI_MODEL")
    ENV["AI_ENABLED"] = "false"
    ENV["ANTHROPIC_API_KEY"] = ""
    ENV["AI_MODEL"] = ""
    example.run
  ensure
    ENV["AI_ENABLED"], ENV["ANTHROPIC_API_KEY"], ENV["AI_MODEL"] = saved
  end

  def config = json_body["data"]

  def local_model(address) = { "provider" => "local", "providers" => { "local" => { "base_url" => address, "model" => "llama3" } } }

  it "needs a sign-in" do
    get "/api/v1/ai/config"

    expect(response).to have_http_status(:unauthorized)
  end

  it "tells everyone AI is off until a provider is chosen" do
    get "/api/v1/ai/config", headers: auth_headers_for(user)

    expect(response).to have_http_status(:ok)
    expect(config).to include("enabled" => false, "provider" => "none", "source" => nil)
  end

  it "tells everyone which provider and model are in use once one is chosen" do
    organization.update!(ai_settings: local_model("http://192.168.1.20:11434/v1"))

    get "/api/v1/ai/config", headers: auth_headers_for(user)

    expect(config).to include("enabled" => true, "provider" => "local", "model" => "llama3", "source" => "app")
  end

  it "says which features are on: none while AI is off, all once it is on, and not one that was switched off" do
    get "/api/v1/ai/config", headers: auth_headers_for(user)
    expect(config["features"]).to eq("priority" => false, "anomalies" => false, "limits" => false, "parts" => false, "draft" => false)

    organization.update!(ai_settings: local_model("http://192.168.1.20:11434/v1"))
    get "/api/v1/ai/config", headers: auth_headers_for(user)
    expect(config["features"]).to eq("priority" => true, "anomalies" => true, "limits" => true, "parts" => true, "draft" => true)

    organization.update!(ai_settings: local_model("http://192.168.1.20:11434/v1").merge("features" => { "priority" => false }))
    get "/api/v1/ai/config", headers: auth_headers_for(user)
    expect(config["features"]).to eq("priority" => false, "anomalies" => true, "limits" => true, "parts" => true, "draft" => true)
  end

  it "does not tell anyone AI is on when the choice is not complete (a Claude key that cannot be read)" do
    unreadable_key = { "anthropic" => { "key_ciphertext" => "garbage" } }
    organization.update!(ai_settings: { "provider" => "anthropic", "providers" => unreadable_key })

    get "/api/v1/ai/config", headers: auth_headers_for(user)

    expect(config).to include("enabled" => false, "provider" => "anthropic")
  end

  it "does not look any name up (it is asked on every page)" do
    organization.update!(ai_settings: local_model("http://model.lan:11434/v1"))
    looked_up = []
    allow(Resolv).to receive(:getaddresses) { |host| looked_up << host }

    get "/api/v1/ai/config", headers: auth_headers_for(user)

    expect(config["enabled"]).to be(true)
    expect(looked_up).to be_empty
  end
end
