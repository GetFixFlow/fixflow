module Ai
  # The one place the AI features call to talk to a model, whichever provider the company chose (see AiConfig): every feature
  # calls Ai::Client.chat or .stream and never a provider itself, and it is the seam specs stub against.
  #
  # Every call says which company it is for (organization:), because the provider, the key and the model are the company's own.
  class Client
    class Error < StandardError; end
    class TimeoutError < Error; end

    DEFAULT_MAX_TOKENS = 1024
    STREAM_TIMEOUT = 30.seconds
    LOCAL_STREAM_TIMEOUT = 120.seconds # a model run on a small machine is slow to start

    # What the company's AI runs on right now (saved on the screen, or else from the server's environment, or else off).
    def self.config(organization = nil) = AiConfig.effective(organization)

    def self.enabled?(organization = nil) = config(organization).active?
    def self.model(organization = nil) = config(organization).model
    def self.stream_timeout(organization = nil) = config(organization).local? ? LOCAL_STREAM_TIMEOUT : STREAM_TIMEOUT

    # Non-streaming call. Returns the response text as a String.
    def self.chat(messages:, system: nil, max_tokens: DEFAULT_MAX_TOKENS, model: nil, organization: nil)
      provider(organization).chat(messages: messages, system: system, max_tokens: max_tokens, model: model)
    end

    # Streaming call. Yields each text delta (String) to the given block. Returns the full accumulated text.
    def self.stream(messages:, system: nil, max_tokens: DEFAULT_MAX_TOKENS, model: nil, organization: nil, &)
      provider(organization).stream(messages: messages, system: system, max_tokens: max_tokens, model: model, &)
    end

    # A call through settings that are not saved yet (the "try it" button).
    def self.provider_for(config)
      raise Error, "AI is switched off." if config.provider == "none"

      case config.provider
      when "anthropic" then Providers::Anthropic.new(config)
      else Providers::OpenAiCompatible.new(config)
      end
    end

    def self.provider(organization)
      config = config(organization)
      raise Error, "AI is switched off or not set up." unless config.active?

      provider_for(config)
    end
    private_class_method :provider
  end
end
