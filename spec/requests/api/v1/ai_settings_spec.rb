require "rails_helper"

RSpec.describe "AI settings", type: :request do
  let(:org)   { create(:organization) }
  let(:admin) { create(:user, :admin, organization: org) }
  let(:local) { { provider: "local", base_url: "http://model.lan:11434/v1", model: "llama3" } }
  let(:service) { { provider: "openai_compatible", base_url: "https://api.example.com/v1", model: "gpt-x", api_key: "sk-oa-SECRET" } }
  let(:claude) { { provider: "anthropic", model: "claude-opus-5-5", api_key: "sk-ant-SECRET" } }

  around do |example|
    saved = ENV.values_at("AI_ENABLED", "ANTHROPIC_API_KEY", "AI_MODEL")
    ENV["AI_ENABLED"] = "false"
    ENV["ANTHROPIC_API_KEY"] = ""
    ENV["AI_MODEL"] = ""
    example.run
  ensure
    ENV["AI_ENABLED"], ENV["ANTHROPIC_API_KEY"], ENV["AI_MODEL"] = saved
  end

  before { allow(Resolv).to receive(:getaddresses) { |host| host.end_with?(".lan") ? ["192.168.1.20"] : ["203.0.113.10"] } }

  def save_ai(settings, as: admin) = patch("/api/v1/ai_settings", params: { ai: settings }, as: :json, headers: auth_headers_for(as))
  def try_ai(settings, as: admin) = post("/api/v1/ai_settings/test", params: { ai: settings }, as: :json, headers: auth_headers_for(as))
  def ai = json_body["ai"]

  describe "who may" do
    it "is for administrators only, in every way" do
      [create(:user, :manager, organization: org), create(:user, organization: org),
       create(:user, :requester, organization: org)].each do |person|
        get "/api/v1/ai_settings", headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
        save_ai({ provider: "none" }, as: person)
        expect(response).to have_http_status(:forbidden)
        delete "/api/v1/ai_settings", headers: auth_headers_for(person)
        expect(response).to have_http_status(:forbidden)
        try_ai(local, as: person)
        expect(response).to have_http_status(:forbidden)
      end
      expect(org.reload.ai_settings).to eq({})
    end

    it "needs a sign-in" do
      get "/api/v1/ai_settings"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/ai_settings" do
    it "starts with AI off: nothing chosen, nothing saved" do
      get "/api/v1/ai_settings", headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(ai).to include("provider" => "none", "enabled" => false, "source" => nil, "environment_configured" => false)
      expect(ai["providers"].keys).to eq(%w[anthropic openai_compatible local])
      expect(ai["providers"]["anthropic"]).to eq("default_model" => "claude-sonnet-5-5", "key_set" => false)
    end

    it "says when the server's environment is what runs the AI" do
      ENV["AI_ENABLED"] = "true"
      ENV["ANTHROPIC_API_KEY"] = "sk-ant-ENV"
      ENV["AI_MODEL"] = "claude-haiku-5-5"

      get "/api/v1/ai_settings", headers: auth_headers_for(admin)

      expect(ai).to include("provider" => "anthropic", "enabled" => true, "source" => "environment", "environment_configured" => true,
                            "where" => "api.anthropic.com")
      expect(ai["providers"]["anthropic"]).to include("model" => "claude-haiku-5-5", "key_set" => true)
      expect(response.body).not_to include("sk-ant-ENV")
    end
  end

  describe "PATCH /api/v1/ai_settings" do
    it "saves a local model, and no key is needed" do
      save_ai(local)

      expect(response).to have_http_status(:ok)
      expect(ai).to include("provider" => "local", "enabled" => true, "source" => "app", "where" => "model.lan")
      expect(ai["providers"]["local"]).to include("base_url" => "http://model.lan:11434/v1", "model" => "llama3", "key_set" => false)
    end

    it "saves Claude with the key encrypted, and never sends it back" do
      save_ai(claude)

      expect(ai).to include("provider" => "anthropic", "enabled" => true)
      expect(ai["providers"]["anthropic"]).to include("model" => "claude-opus-5-5", "key_set" => true)
      expect(response.body).not_to include("sk-ant-SECRET")
      expect(org.reload.ai_settings.to_json).not_to include("sk-ant-SECRET")
      expect(org.ai_config.api_key).to eq("sk-ant-SECRET")
      get "/api/v1/ai_settings", headers: auth_headers_for(admin)
      expect(response.body).not_to include("sk-ant-SECRET")
    end

    it "saves an OpenAI-compatible service" do
      save_ai(service)

      expect(ai).to include("provider" => "openai_compatible", "enabled" => true, "where" => "api.example.com")
      expect(ai["providers"]["openai_compatible"]).to include("base_url" => "https://api.example.com/v1", "key_set" => true)
    end

    it "keeps the saved key when the form leaves it blank" do
      save_ai(claude)
      save_ai(claude.merge(model: "claude-haiku-5-5", api_key: ""))

      expect(response).to have_http_status(:ok)
      expect(org.reload.ai_config.api_key).to eq("sk-ant-SECRET")
      expect(org.ai_config.model).to eq("claude-haiku-5-5")
    end

    it "switches AI off and keeps every provider's settings for later" do
      save_ai(claude)
      save_ai({ provider: "none" })

      expect(ai).to include("provider" => "none", "enabled" => false, "source" => "app")
      expect(ai["providers"]["anthropic"]).to include("key_set" => true)
      expect(Ai::Client.enabled?(org)).to be(false)
    end

    it "lets a company switch AI off even though the server's environment would switch it on" do
      ENV["AI_ENABLED"] = "true"
      ENV["ANTHROPIC_API_KEY"] = "sk-ant-ENV"
      save_ai({ provider: "none" })

      expect(ai).to include("enabled" => false, "source" => "app")
    end

    it "does not copy the environment's key into the database when a form that was filled in without a key is saved" do
      ENV["AI_ENABLED"] = "true"
      ENV["ANTHROPIC_API_KEY"] = "sk-ant-ENV"
      save_ai({ provider: "anthropic", model: "claude-opus-5-5" })

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["message"]).to eq("Key is missing")
      expect(org.reload.ai_settings).to eq({})
    end

    describe "refuses, with the reason, and saves nothing" do
      {
        "a provider that does not exist" =>
          [-> { { provider: "skynet" } }, "Provider must be one of none, anthropic, openai_compatible, local"],
        "Claude without a key" => [-> { { provider: "anthropic" } }, "Key is missing"],
        "a local model on the internet, because the point of it is that nothing leaves" =>
          [-> { local.merge(base_url: "http://model.example.com/v1") }, /\AAddress is not on this server or a private network/],
        "an OpenAI-compatible service on a private network, which is the local choice" =>
          [-> { service.merge(base_url: "https://ai.lan/v1") }, /\AAddress is on a private network. Use the Local model choice/],
        "an OpenAI-compatible service over plain http" =>
          [-> { service.merge(base_url: "http://api.example.com/v1") }, "Address must start with https://"],
        "a model with no name, where there is no default" => [-> { local.merge(model: "") }, "Model is missing"]
      }.each do |name, (settings, message)|
        it name do
          save_ai(instance_exec(&settings))

          expect(response).to have_http_status(:unprocessable_entity)
          expect(json_body["error"]).to include("code" => "VALIDATION_ERROR", "message" => message)
          expect(org.reload.ai_settings).to eq({})
        end
      end

      it "the cloud metadata address, as either kind" do
        allow(Resolv).to receive(:getaddresses).and_return(["169.254.169.254"])

        [local.merge(base_url: "http://metadata.lan/"), service.merge(base_url: "https://metadata.example.com/")].each do |settings|
          save_ai(settings)

          expect(response).to have_http_status(:unprocessable_entity)
          expect(json_body["error"]["message"]).to match(/never an AI service/)
        end
        expect(org.reload.ai_settings).to eq({})
      end
    end

    it "drops the saved key when the address moves to another host, and says a key is needed again" do
      save_ai(service)
      save_ai(service.merge(base_url: "https://other.example.org/v1", api_key: ""))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["message"]).to eq("Key is missing")
      expect(org.reload.ai_config.setting("openai_compatible").base_url).to eq("https://api.example.com/v1")
    end

    it "does not send one provider's key to another when the choice changes" do
      save_ai(claude)
      save_ai(local)

      expect(org.reload.ai_config.api_key).to be_nil
      expect(org.ai_config.setting("anthropic").api_key).to eq("sk-ant-SECRET")
    end

    it "writes to the audit log without a key" do
      expect { save_ai(claude) }.to change { ActivityLog.where(action: "ai_settings.updated").count }.by(1)

      entry = ActivityLog.where(action: "ai_settings.updated").last
      expect(entry.to_json).not_to include("sk-ant-SECRET")
      expect(entry.metadata).to include("provider" => "anthropic", "model" => "claude-opus-5-5")
    end
  end

  describe "DELETE /api/v1/ai_settings" do
    it "forgets everything, and a server set up through its environment goes back to using that" do
      ENV["AI_ENABLED"] = "true"
      ENV["ANTHROPIC_API_KEY"] = "sk-ant-ENV"
      save_ai(local)
      expect(ai["source"]).to eq("app")

      expect { delete "/api/v1/ai_settings", headers: auth_headers_for(admin) }
        .to change { ActivityLog.where(action: "ai_settings.removed").count }.by(1)

      expect(org.reload.ai_settings).to eq({})
      expect(ai).to include("provider" => "anthropic", "source" => "environment")
    end
  end

  describe "POST /api/v1/ai_settings/test" do
    let(:chat) { "http://model.lan:11434/v1/chat/completions" }

    def model_says(text)
      { status: 200, headers: { "Content-Type" => "application/json" }, body: { choices: [{ message: { content: text } }] }.to_json }
    end

    def claude_says(text)
      { status: 200, headers: { "Content-Type" => "application/json" },
        body: { id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: text }],
                stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }.to_json }
    end

    it "asks the model a fixed question and says it is connected, without saving anything" do
      question = [{ "role" => "user", "content" => "Reply with the single word: ready" }]
      stub = stub_request(:post, chat).with { |r| (b = JSON.parse(r.body)) && b["messages"] == question && b["max_tokens"] == 32 }
                                      .to_return(model_says("ready"))

      try_ai(local)

      expect(response).to have_http_status(:ok)
      expect(json_body).to include("success" => true, "reply" => "ready")
      expect(json_body["message"]).to match(/\AConnected\. model\.lan answered in [\d.]+ s\.\z/)
      expect(stub).to have_been_requested
      expect(org.reload.ai_settings).to eq({})
    end

    it "sends no company data: only the fixed question" do
      create(:work_order, organization: org, title: "Pump leaking oil")
      stub_request(:post, chat).to_return(model_says("ready"))

      try_ai(local)

      expect(WebMock).to(have_requested(:post, chat).with { |r| r.body.exclude?("Pump leaking oil") })
    end

    it "uses the key that is saved when the form leaves it blank" do
      save_ai(service)
      stub = stub_request(:post, "https://api.example.com/v1/chat/completions")
             .with(headers: { "Authorization" => "Bearer sk-oa-SECRET" }).to_return(model_says("ready"))

      try_ai(service.merge(api_key: ""))

      expect(json_body["success"]).to be(true)
      expect(stub).to have_been_requested
    end

    it "can try the environment's Claude key, which is not saved anywhere" do
      ENV["AI_ENABLED"] = "true"
      ENV["ANTHROPIC_API_KEY"] = "sk-ant-ENV"
      stub = stub_request(:post, "https://api.anthropic.com/v1/messages")
             .with(headers: { "X-Api-Key" => "sk-ant-ENV" }).to_return(claude_says("ready"))

      try_ai({ provider: "anthropic", model: "claude-opus-5-5" })

      expect(json_body["success"]).to be(true)
      expect(stub).to have_been_requested
    end

    it "says in words what went wrong, as a 422 the screen can show" do
      stub_request(:post, chat).to_raise(Errno::ECONNREFUSED)

      try_ai(local)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]).to include("code" => "AI_TEST_FAILED",
                                            "message" => "Nothing is answering at model.lan. Is the service running?")
    end

    it "says a key was refused without repeating it" do
      stub_request(:post, "https://api.example.com/v1/chat/completions")
        .to_return(status: 401, body: { error: { message: "bad key sk-oa-SECRET" } }.to_json)

      try_ai(service)

      expect(json_body["error"]["message"]).to eq("api.example.com did not accept the key.")
      expect(response.body).not_to include("sk-oa-SECRET")
    end

    it "refuses an address that may not be used, before it calls anything" do
      try_ai(local.merge(base_url: "http://model.example.com/v1"))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["message"]).to include("Address is not on this server or a private network")
      expect(WebMock).not_to have_requested(:any, /example/)
    end

    it "has nothing to try when AI is off" do
      try_ai({ provider: "none" })

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body["error"]["message"]).to eq("Choose a provider first.")
    end
  end
end
