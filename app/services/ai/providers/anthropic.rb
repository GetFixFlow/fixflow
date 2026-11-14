module Ai
  module Providers
    # Claude, through Anthropic's own SDK. The key is the company's own (or the server's, for an install set up through its
    # environment) and goes only to Anthropic.
    class Anthropic
      def initialize(config)
        @config = config
      end

      # Returns the answer as a String.
      def chat(messages:, system: nil, max_tokens: Client::DEFAULT_MAX_TOKENS, model: nil)
        guard do
          response = sdk.messages.create(model: model || @config.model, max_tokens: max_tokens, system: system, messages: messages)
          response.content.find { |block| block.type == :text }&.text.to_s
        end
      end

      # Yields each piece of the answer as it arrives, and returns the whole of it.
      def stream(messages:, system: nil, max_tokens: Client::DEFAULT_MAX_TOKENS, model: nil, &block)
        guard do
          stream = sdk.messages.stream(model: model || @config.model, max_tokens: max_tokens, system: system, messages: messages)
          stream.text.each { |delta| block.call(delta) }
          stream.accumulated_text
        end
      end

      private

      # max_retries: 0 because this happens inside a web request (including a live stream): the SDK's own retries would add
      # seconds of waiting the person cannot see. A job that wants a retry can ask again itself.
      def sdk
        ::Anthropic::Client.new(api_key: @config.api_key, max_retries: 0)
      end

      def guard
        yield
      rescue ::Anthropic::Errors::APITimeoutError => e
        raise Client::TimeoutError, e.message
      rescue ::Anthropic::Errors::AuthenticationError, ::Anthropic::Errors::PermissionDeniedError
        raise Client::Error, "Anthropic did not accept the key."
      rescue ::Anthropic::Errors::NotFoundError
        raise Client::Error, "Anthropic does not know the model #{@config.model}."
      rescue ::Anthropic::Errors::RateLimitError
        raise Client::Error, "Anthropic says the limit was reached. Try again in a minute."
      rescue ::Anthropic::Errors::APIConnectionError => e
        raise Client::Error, "Anthropic could not be reached (#{e.message})."
      rescue ::Anthropic::Errors::APIError => e
        raise Client::Error, e.message
      end
    end
  end
end
