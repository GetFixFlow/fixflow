require "rails_helper"

RSpec.describe "Api::V1::Ai::Priority", type: :request do
  let(:organization) { create(:organization) }
  let(:user)  { create(:user, organization: organization) }
  let(:asset) { create(:asset, organization: organization) }
  let(:reply) { '{"priority":"high","reason":"Oil is leaking."}' }

  around do |example|
    saved = ENV.values_at("AI_ENABLED", "ANTHROPIC_API_KEY", "AI_MODEL")
    ENV["AI_ENABLED"] = "true"
    ENV["ANTHROPIC_API_KEY"] = "sk-test-key"
    ENV["AI_MODEL"] = ""
    example.run
  ensure
    ENV["AI_ENABLED"], ENV["ANTHROPIC_API_KEY"], ENV["AI_MODEL"] = saved
  end

  def ask(as: user, **params)
    params = { title: "Pump is leaking oil" } if params.empty?
    post "/api/v1/ai/priority", params: params, headers: auth_headers_for(as)
  end

  it "needs a sign-in" do
    post "/api/v1/ai/priority", params: { title: "x" }

    expect(response).to have_http_status(:unauthorized)
  end

  it "suggests a priority and says why, and saves nothing" do
    allow(Ai::Client).to receive(:chat).and_return(reply)

    sent = nil
    allow(Ai::Client).to receive(:chat) do |**args|
      sent = args
      reply
    end

    expect { ask(title: "Pump is leaking oil", description: "left seal", asset_id: asset.id) }.not_to change(WorkOrder, :count)

    expect(response).to have_http_status(:ok)
    expect(json_body["data"]).to eq("priority" => "high", "reason" => "Oil is leaking.")
    expect(sent[:organization]).to eq(organization)
    expect(sent[:messages].first[:content]).to include("Pump is leaking oil", "left seal", asset.name)
  end

  it "works without an asset" do
    allow(Ai::Client).to receive(:chat).and_return(reply)

    ask

    expect(response).to have_http_status(:ok)
  end

  it "needs a title" do
    ask(description: "no title")

    expect(response).to have_http_status(:bad_request)
  end

  it "is not available to a requester, who cannot create a work order" do
    ask(title: "x", as: create(:user, :requester, organization: organization))

    expect(response).to have_http_status(:forbidden)
  end

  it "does not look at another company's asset" do
    ask(title: "x", asset_id: create(:asset).id)

    expect(response).to have_http_status(:not_found)
  end

  it "says in the provider's own words when it fails" do
    allow(Ai::Client).to receive(:chat).and_raise(Ai::Client::Error, "Anthropic did not accept the key.")

    ask

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json_body.dig("error", "message")).to eq("Anthropic did not accept the key.")
    expect(json_body.dig("error", "code")).to eq("AI_FAILED")
  end

  it "says so when the answer was not a priority" do
    allow(Ai::Client).to receive(:chat).and_return("I would rather not say.")

    ask

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json_body.dig("error", "message")).to include("could not be read")
  end

  describe "when it is off" do
    it "is unavailable when AI is off, and when the company switched this feature off, without asking the provider" do
      expect(Ai::Client).not_to receive(:chat)
      ENV["AI_ENABLED"] = "false"
      ask
      expect(response).to have_http_status(:service_unavailable)
      expect(json_body.dig("error", "code")).to eq("AI_DISABLED")

      ENV["AI_ENABLED"] = "true"
      organization.update!(ai_settings: { "features" => { "priority" => false } })
      ask
      expect(response).to have_http_status(:service_unavailable)
      expect(json_body.dig("error", "code")).to eq("AI_FEATURE_OFF")
    end

    it "stays available when only the other feature is switched off" do
      allow(Ai::Client).to receive(:chat).and_return(reply)
      organization.update!(ai_settings: { "features" => { "anomalies" => false } })

      ask

      expect(response).to have_http_status(:ok)
    end
  end
end
