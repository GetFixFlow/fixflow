require "rails_helper"

RSpec.describe "Api::V1::Ai::Assist", type: :request do
  let(:organization) { create(:organization) }
  let(:user)          { create(:user, organization: organization, role: "technician") }
  let(:asset)          { create(:asset, organization: organization) }
  let(:work_order)     { create(:work_order, organization: organization, asset: asset) }

  around do |example|
    original_enabled = ENV["AI_ENABLED"]
    original_key     = ENV["ANTHROPIC_API_KEY"]
    ENV["AI_ENABLED"] = "true"
    ENV["ANTHROPIC_API_KEY"] = "sk-test-key"
    example.run
    ENV["AI_ENABLED"] = original_enabled
    ENV["ANTHROPIC_API_KEY"] = original_key
  end

  describe "POST /api/v1/ai/assist" do
    it "requires authentication" do
      post "/api/v1/ai/assist", params: { work_order_id: work_order.id, message: "hi" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns 503 when AI is disabled" do
      ENV["AI_ENABLED"] = "false"

      post "/api/v1/ai/assist",
        params: { work_order_id: work_order.id, message: "hi" },
        headers: auth_headers_for(user)

      expect(response).to have_http_status(:service_unavailable)
    end

    it "streams a text/event-stream response with accumulated deltas and a done frame" do
      allow(Ai::Client).to receive(:stream) do |messages:, system:, &block|
        block.call("Hello ")
        block.call("technician")
        "Hello technician"
      end

      post "/api/v1/ai/assist",
        params: { work_order_id: work_order.id, message: "What tools do I need?" },
        headers: auth_headers_for(user)

      expect(response.content_type).to include("text/event-stream")
      expect(response.body).to include('"text":"Hello "')
      expect(response.body).to include('"text":"technician"')
      expect(response.body).to include('"done":true')
    end

    it "writes a graceful SSE error frame (not a 500) when the AI client times out" do
      allow(Ai::Client).to receive(:stream).and_raise(Ai::Client::TimeoutError, "timed out")

      post "/api/v1/ai/assist",
        params: { work_order_id: work_order.id, message: "What tools do I need?" },
        headers: auth_headers_for(user)

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('"error"')
    end

    it "returns a 404-style error frame for a work order in another organization" do
      other_org_wo = create(:work_order, organization: create(:organization))

      post "/api/v1/ai/assist",
        params: { work_order_id: other_org_wo.id, message: "hi" },
        headers: auth_headers_for(user)

      expect(response.body).to include("Work order not found")
    end
  end
end
