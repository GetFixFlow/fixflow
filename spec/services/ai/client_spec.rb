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
