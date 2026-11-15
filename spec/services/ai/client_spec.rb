require "rails_helper"

RSpec.describe Ai::Client do
  around do |example|
    original_enabled = ENV["AI_ENABLED"]
    original_key     = ENV["ANTHROPIC_API_KEY"]
    ENV["AI_ENABLED"] = "true"
    ENV["ANTHROPIC_API_KEY"] = "sk-test-key"
    example.run
    ENV["AI_ENABLED"] = original_enabled
    ENV["ANTHROPIC_API_KEY"] = original_key
  end

  describe ".enabled?" do
    it "is true when AI_ENABLED and ANTHROPIC_API_KEY are both set" do
      expect(described_class.enabled?).to eq(true)
    end

    it "is false when AI_ENABLED is false" do
      ENV["AI_ENABLED"] = "false"
      expect(described_class.enabled?).to eq(false)
    end

    it "is false when ANTHROPIC_API_KEY is blank" do
      ENV["ANTHROPIC_API_KEY"] = ""
      expect(described_class.enabled?).to eq(false)
    end
  end

  describe "for a company" do
    let(:org) { create(:organization) }
    let(:hi) { [{ role: "user", content: "Hi" }] }
    let(:local_model) do
      { "provider" => "local", "providers" => { "local" => { "base_url" => "http://model.lan:11434/v1", "model" => "llama3" } } }
    end

    before { allow(Resolv).to receive(:getaddresses) { |host| host == "model.lan" ? ["192.168.1.20"] : ["203.0.113.10"] } }

    def choose(settings) = org.update!(ai_settings: settings)

    def json_reply(status, body) = { status: status, headers: { "Content-Type" => "application/json" }, body: body.to_json }

    it "runs on the server's environment until the company saves something" do
      expect(described_class.enabled?(org)).to eq(true)
      expect(described_class.config(org).source).to eq("environment")
    end

    it "is off for a company that chose off, and for one with nothing set up when the environment does not switch it on" do
      choose("provider" => "none")
      expect(described_class.enabled?(org)).to eq(false)

      ENV["AI_ENABLED"] = "false"
      org.update!(ai_settings: {})
      expect(described_class.enabled?(org)).to eq(false)
    end

    it "refuses a call when it is off" do
      choose("provider" => "none")

      expect { described_class.chat(messages: hi, organization: org) }.to raise_error(Ai::Client::Error, /switched off/)
    end

    it "sends the company's own key to Anthropic, not the server's" do
      key = AiSecret.encrypt("sk-ant-COMPANY")
      choose("provider" => "anthropic", "providers" => { "anthropic" => { "model" => "claude-opus-5-5", "key_ciphertext" => key } })
      stub = stub_request(:post, "https://api.anthropic.com/v1/messages")
             .with(headers: { "X-Api-Key" => "sk-ant-COMPANY" }, body: hash_including("model" => "claude-opus-5-5"))
             .to_return(json_reply(200, id: "m", type: "message", role: "assistant", model: "claude-opus-5-5",
                                        content: [{ type: "text", text: "Hi from Claude" }], stop_reason: "end_turn",
                                        usage: { input_tokens: 1, output_tokens: 1 }))

      expect(described_class.chat(messages: hi, organization: org)).to eq("Hi from Claude")
      expect(stub).to have_been_requested
    end

    it "says in words that Anthropic did not accept the key, and which model it does not know" do
      stub_request(:post, "https://api.anthropic.com/v1/messages")
        .to_return(json_reply(401, type: "error", error: { type: "authentication_error", message: "invalid x-api-key" }))
      expect { described_class.chat(messages: hi, organization: org) }
        .to raise_error(Ai::Client::Error, "Anthropic did not accept the key.")

      stub_request(:post, "https://api.anthropic.com/v1/messages")
        .to_return(json_reply(404, type: "error", error: { type: "not_found_error", message: "model: nope" }))
      expect { described_class.chat(messages: hi, organization: org) }.to raise_error(Ai::Client::Error, /does not know the model/)
    end

    it "uses a model run on the company's own network, and nothing goes to Anthropic" do
      choose(local_model)
      stub = stub_request(:post, "http://model.lan:11434/v1/chat/completions")
             .to_return(json_reply(200, choices: [{ message: { content: "Local hello" } }]))

      expect(described_class.chat(messages: hi, organization: org)).to eq("Local hello")
      expect(stub).to have_been_requested
      expect(WebMock).not_to have_requested(:any, /anthropic/)
    end

    it "streams through the chosen provider" do
      choose(local_model)
      events = %w[A B].map { |letter| "data: #{{ choices: [{ delta: { content: letter } }] }.to_json}\n\n" }.join
      stub_request(:post, "http://model.lan:11434/v1/chat/completions")
        .to_return(status: 200, headers: { "Content-Type" => "text/event-stream" }, body: "#{events}data: [DONE]\n\n")
      pieces = []

      expect(described_class.stream(messages: hi, organization: org) { |piece| pieces << piece }).to eq("AB")
      expect(pieces).to eq(%w[A B])
    end

    it "gives a model on a small machine longer to answer" do
      expect(described_class.stream_timeout(org)).to eq(Ai::Client::STREAM_TIMEOUT)
      choose(local_model)
      expect(described_class.stream_timeout(org)).to eq(Ai::Client::LOCAL_STREAM_TIMEOUT)
    end

    it "is off when the address, written as numbers, is not on a private network" do
      choose("provider" => "local", "providers" => { "local" => { "base_url" => "http://203.0.113.10:11434/v1", "model" => "llama3" } })

      expect(described_class.enabled?(org)).to be(false)
    end

    it "refuses the call, in words, when a name has started pointing off the network (it is looked up again every time)" do
      choose(local_model)
      allow(Resolv).to receive(:getaddresses).with("model.lan").and_return(["203.0.113.10"])

      expect(described_class.enabled?(org)).to be(true) # asking whether AI is on does not look names up
      expect { described_class.chat(messages: hi, organization: org) }.to raise_error(Ai::Client::Error, /would leave it/)
      expect(WebMock).not_to have_requested(:any, /model\.lan/)
    end
  end

  describe ".chat" do
    it "returns the text content from a successful response" do
      stub_request(:post, "https://api.anthropic.com/v1/messages")
        .to_return(
          status: 200,
          headers: { "Content-Type" => "application/json" },
          body: {
            id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-4-6",
            content: [ { type: "text", text: "Hello from Claude" } ],
            stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }
          }.to_json
        )

      result = described_class.chat(messages: [ { role: "user", content: "Hi" } ], system: "Be helpful")
      expect(result).to eq("Hello from Claude")
    end

    it "raises Ai::Client::TimeoutError on a connection timeout" do
      stub_request(:post, "https://api.anthropic.com/v1/messages").to_timeout

      expect {
        described_class.chat(messages: [ { role: "user", content: "Hi" } ])
      }.to raise_error(Ai::Client::TimeoutError)
    end

    it "raises Ai::Client::Error on an API error response" do
      stub_request(:post, "https://api.anthropic.com/v1/messages")
        .to_return(
          status: 500,
          headers: { "Content-Type" => "application/json" },
          body: { type: "error", error: { type: "api_error", message: "Internal error" } }.to_json
        )

      expect {
        described_class.chat(messages: [ { role: "user", content: "Hi" } ])
      }.to raise_error(Ai::Client::Error)
    end
  end
end
