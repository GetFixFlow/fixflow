require "rails_helper"

RSpec.describe "Api::V1::Ai::Drafts", type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user, organization: organization) }
  let(:line3) { create(:location, organization: organization, name: "Line 3") }
  let!(:pump) { create(:asset, organization: organization, name: "Coolant pump", asset_tag: "P-003", location: line3) }
  let(:reply) { { title: "Coolant pump leaking oil", description: "Leaking on line 3.", priority: "high", asset: pump.id }.to_json }

  around do |example|
    saved = ENV.values_at("AI_ENABLED", "ANTHROPIC_API_KEY", "AI_MODEL")
    ENV["AI_ENABLED"] = "true"
    ENV["ANTHROPIC_API_KEY"] = "sk-test-key"
    ENV["AI_MODEL"] = ""
    example.run
  ensure
    ENV["AI_ENABLED"], ENV["ANTHROPIC_API_KEY"], ENV["AI_MODEL"] = saved
  end

  def draft(as: user, **params)
    params = { text: "pump on line 3 is leaking oil" } if params.empty?
    post "/api/v1/ai/work_order_draft", params: params, headers: auth_headers_for(as)
  end

  def data = json_body["data"]

  it "needs a sign-in" do
    post "/api/v1/ai/work_order_draft", params: { text: "pump on line 3 is leaking oil" }

    expect(response).to have_http_status(:unauthorized)
  end

  it "gives a draft: title, description, priority, the asset, and the assets it chose from; and saves nothing" do
    allow(Ai::Client).to receive(:chat).and_return(reply)

    expect { draft }.not_to change(WorkOrder, :count)

    expect(response).to have_http_status(:ok)
    chosen = { "id" => pump.id, "name" => "Coolant pump", "asset_tag" => "P-003", "location_path" => "Line 3" }
    expect(data).to eq("title" => "Coolant pump leaking oil", "description" => "Leaking on line 3.", "priority" => "high",
                       "asset" => chosen, "asset_candidates" => [chosen])
  end

  it "has no asset when the model chose none" do
    allow(Ai::Client).to receive(:chat).and_return({ title: "Something is wrong", asset: nil }.to_json)

    draft

    expect(data["asset"]).to be_nil
    expect(data["priority"]).to be_nil
  end

  it "needs the words" do
    draft(other: "x")

    expect(response).to have_http_status(:bad_request)
  end

  it "asks for a little more when there are too few" do
    expect(Ai::Client).not_to receive(:chat)

    draft(text: "pump")

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json_body.dig("error", "message")).to eq("Say a little more about the problem.")
  end

  it "is not for a requester, who cannot create a work order" do
    draft(text: "pump on line 3 is leaking oil", as: create(:user, :requester, organization: organization))

    expect(response).to have_http_status(:forbidden)
  end

  it "never offers another company's asset" do
    create(:asset, name: "Coolant pump of another company")
    allow(Ai::Client).to receive(:chat).and_return(reply)

    draft

    expect(data["asset_candidates"].pluck("name")).to eq(["Coolant pump"])
  end

  it "says in the provider's own words when it fails" do
    allow(Ai::Client).to receive(:chat).and_raise(Ai::Client::Error, "Anthropic did not accept the key.")

    draft

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json_body["error"]).to include("message" => "Anthropic did not accept the key.", "code" => "AI_FAILED")
  end

  it "says so when the answer was not a work order" do
    allow(Ai::Client).to receive(:chat).and_return("I would rather not.")

    draft

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json_body.dig("error", "message")).to include("could not be read")
  end

  describe "when it is off" do
    it "is unavailable when AI is off, and once the company switched drafting off, without asking the provider" do
      expect(Ai::Client).not_to receive(:chat)
      ENV["AI_ENABLED"] = "false"
      draft
      expect(response).to have_http_status(:service_unavailable)
      expect(json_body.dig("error", "code")).to eq("AI_DISABLED")

      ENV["AI_ENABLED"] = "true"
      organization.update!(ai_settings: { "features" => { "draft" => false } })
      draft
      expect(response).to have_http_status(:service_unavailable)
      expect(json_body.dig("error", "code")).to eq("AI_FEATURE_OFF")
    end

    it "stays available when only another feature is switched off" do
      allow(Ai::Client).to receive(:chat).and_return(reply)
      organization.update!(ai_settings: { "features" => { "priority" => false } })

      draft

      expect(response).to have_http_status(:ok)
    end
  end
end
