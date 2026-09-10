module Ai
  # Thin wrapper around the Anthropic Ruby SDK, following this codebase's
  # class-method-only service convention (see Iot::RuleEvaluatorService,
  # PmSchedulerService). Every AI feature service calls Ai::Client.chat/.stream
  # instead of touching Anthropic::Client directly — this is the single seam
  # specs stub against.
  class Client
    class Error < StandardError; end
    class TimeoutError < Error; end

    DEFAULT_MAX_TOKENS = 1024

    def self.enabled?
      ActiveModel::Type::Boolean.new.cast(ENV["AI_ENABLED"]) && ENV["ANTHROPIC_API_KEY"].present?
    end

    def self.model
      ENV.fetch("AI_MODEL", "claude-sonnet-4-6")
    end

    # Non-streaming call. Returns the response text as a String.
    def self.chat(messages:, system: nil, max_tokens: DEFAULT_MAX_TOKENS, model: nil)
      response = sdk_client.messages.create(
        model: model || self.model,
        max_tokens: max_tokens,
        system: system,
        messages: messages
      )
      response.content.find { |block| block.type == :text }&.text.to_s
    rescue Anthropic::Errors::APITimeoutError => e
      raise TimeoutError, e.message
    rescue Anthropic::Errors::APIError => e
      raise Error, e.message
    end

    # Streaming call. Yields each text delta (String) to the given block.
    # Returns the full accumulated text.
    def self.stream(messages:, system: nil, max_tokens: DEFAULT_MAX_TOKENS, model: nil, &block)
      stream = sdk_client.messages.stream(
        model: model || self.model,
        max_tokens: max_tokens,
        system: system,
        messages: messages
      )
      stream.text.each { |delta| block.call(delta) }
      stream.accumulated_text
    rescue Anthropic::Errors::APITimeoutError => e
      raise TimeoutError, e.message
    rescue Anthropic::Errors::APIError => e
      raise Error, e.message
    end

    private_class_method def self.sdk_client
      # max_retries: 0 — this call happens synchronously inside a web request
      # (including inside an ActionController::Live stream); the SDK's default
      # exponential-backoff retries would silently add multi-second latency to
      # user-facing requests. Callers/jobs that want retry behavior should wrap
      # Ai::Client.chat themselves (e.g. via Sidekiq's own job retry).
      @sdk_client ||= Anthropic::Client.new(api_key: ENV.fetch("ANTHROPIC_API_KEY"), max_retries: 0)
    end
  end
end
