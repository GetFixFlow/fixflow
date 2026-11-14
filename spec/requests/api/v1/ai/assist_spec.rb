require "rails_helper"

RSpec.describe "Api::V1::Ai::Assist", type: :request do
  let(:organization) { create(:organization) }
  let(:user)          { create(:user, organization: organization, role: "technician") }
  let(:asset)          { create(:asset, organization: organization) }
  let(:work_order)     { create(:work_order, organization: organization, asset: asset) }

  let(:local_model) do
    { "provider" => "local", "providers" => { "local" => { "base_url" => "http://model.lan:11434/v1", "model" => "llama3" } } }
  end

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

    it "returns 503 when the company chose AI off, even though the server's environment would switch it on" do
      organization.update!(ai_settings: { "provider" => "none" })

      post "/api/v1/ai/assist", params: { work_order_id: work_order.id, message: "hi" }, headers: auth_headers_for(user)

      expect(response).to have_http_status(:service_unavailable)
    end

    it "answers from the company's own provider: a model on its own network, with no Claude key involved" do
      ENV["ANTHROPIC_API_KEY"] = ""
      allow(Resolv).to receive(:getaddresses).and_return(["192.168.1.20"])
      organization.update!(ai_settings: local_model)
      stub = stub_request(:post, "http://model.lan:11434/v1/chat/completions")
             .with(body: hash_including("model" => "llama3"))
             .to_return(status: 200, headers: { "Content-Type" => "text/event-stream" },
                        body: "data: #{{ choices: [{ delta: { content: 'Check the seal' } }] }.to_json}\n\ndata: [DONE]\n\n")

      post "/api/v1/ai/assist", params: { work_order_id: work_order.id, message: "hi" }, headers: auth_headers_for(user)

      expect(stub).to have_been_requested
      sent = have_requested(:post, "http://model.lan:11434/v1/chat/completions").with { |r| r.body.include?(work_order.title) }
      expect(WebMock).to(sent)
      expect(response.body).to include('"text":"Check the seal"').and include('"done":true')
    end

    it "gives a model run on the company's own network two minutes to answer, and the others thirty seconds" do
      allow(Resolv).to receive(:getaddresses).and_return(["192.168.1.20"])
      allow(Ai::Client).to receive(:stream)
      limits = []
      allow(Timeout).to receive(:timeout).and_wrap_original do |original, seconds, *args, &block|
        limits << seconds
        original.call(seconds, *args, &block)
      end

      post "/api/v1/ai/assist", params: { work_order_id: work_order.id, message: "hi" }, headers: auth_headers_for(user)
      organization.update!(ai_settings: local_model)
      post "/api/v1/ai/assist", params: { work_order_id: work_order.id, message: "hi" }, headers: auth_headers_for(user)

      expect(limits.first(2)).to eq([30.seconds, 120.seconds])
    end

    it "writes the provider's own words in an error frame when it refuses" do
      allow(Resolv).to receive(:getaddresses).and_return(["192.168.1.20"])
      organization.update!(ai_settings: local_model)
      stub_request(:post, "http://model.lan:11434/v1/chat/completions").to_raise(Errno::ECONNREFUSED)

      post "/api/v1/ai/assist", params: { work_order_id: work_order.id, message: "hi" }, headers: auth_headers_for(user)

      expect(response.body).to include("Nothing is answering at model.lan")
    end

    it "names the manuals it drew on in the last frame" do
      create(:asset_document, asset: asset, file_name: "pump-manual.pdf")
      allow(Ai::PdfTextExtractorService).to receive(:extract).and_return("text")
      allow(Ai::Client).to receive(:stream)

      post "/api/v1/ai/assist", params: { work_order_id: work_order.id, message: "hi" }, headers: auth_headers_for(user)

      expect(response.body).to include('"citations":["pump-manual.pdf"]')
    end

    it "streams a text/event-stream response with accumulated deltas and a done frame" do
      allow(Ai::Client).to receive(:stream) do |messages:, system:, organization:, &block|
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
