require "net/http"

module Ai
  module Providers
    # Any service or program that speaks the OpenAI chat API (POST {address}/chat/completions): OpenAI itself, OpenRouter, Groq,
    # and the programs people run on their own machines (Ollama, LM Studio, vLLM, llama.cpp). It is used for both the
    # "OpenAI-compatible service" and the "local model" choices; AiAddress decides which addresses each may use, when the setting
    # is saved and again before every call, and the connection goes to the address that was checked. Redirects are not followed
    # (the key would go along). No gem: it is one POST.
    class OpenAiCompatible
      OPEN_TIMEOUT = 5
      READ_TIMEOUT = 60
      LOCAL_READ_TIMEOUT = 120 # a model on a small machine can take a while to load before it says anything

      # No connection could be made to this address, so the next one is worth a try.
      NOT_REACHED = [Errno::ECONNREFUSED, Errno::EHOSTUNREACH, Errno::ENETUNREACH, Errno::EADDRNOTAVAIL, Errno::EAFNOSUPPORT,
                     Net::OpenTimeout].freeze

      # Newer OpenAI models want max_completion_tokens in place of max_tokens; the programs people run want max_tokens.
      class TokenNameRefused < StandardError; end

      def initialize(config)
        @config = config
      end

      def chat(messages:, system: nil, max_tokens: Client::DEFAULT_MAX_TOKENS, model: nil)
        text = nil
        call(payload(messages, system, max_tokens, model, stream: false)) { |response| text = text_of(response.read_body) }
        text
      end

      def stream(messages:, system: nil, max_tokens: Client::DEFAULT_MAX_TOKENS, model: nil, &block)
        text = +""
        call(payload(messages, system, max_tokens, model, stream: true)) do |response|
          if response["Content-Type"].to_s.include?("json") # a server that ignored stream: true and answered in one piece
            text << text_of(response.read_body).tap { |whole| block.call(whole) if whole.present? }
          else
            read_events(response) { |delta| text << delta.tap(&block) }
          end
        end
        text
      end

      private

      def payload(messages, system, max_tokens, model, stream:)
        turns = system.present? ? [{ role: "system", content: system }] + messages : messages
        { model: model || @config.model, messages: turns, max_tokens: max_tokens, stream: stream }
      end

      def call(payload, &)
        perform(payload, &)
      rescue TokenNameRefused
        perform(payload.except(:max_tokens).merge(max_completion_tokens: payload[:max_tokens]), retried: true, &)
      end

      def perform(payload, retried: false, &)
        uri = URI.parse("#{@config.base_url.to_s.chomp('/')}/chat/completions")
        addresses = AiAddress.checked_addresses(@config.provider, uri)
        addresses.each_with_index do |address, index|
          return attempt(uri, address, payload, retried, &)
        rescue *NOT_REACHED
          raise if index == addresses.size - 1
        end
      rescue Net::OpenTimeout, Net::ReadTimeout
        raise Client::TimeoutError, "#{where} did not answer in time."
      rescue AiAddress::Refused => e
        raise Client::Error, e.message
      rescue Errno::ECONNREFUSED
        raise Client::Error, "Nothing is answering at #{where}. Is the service running?"
      rescue SocketError, Errno::EHOSTUNREACH, Errno::ENETUNREACH, Errno::ECONNRESET, EOFError
        raise Client::Error, "#{where} could not be reached."
      rescue OpenSSL::SSL::SSLError => e
        raise Client::Error, "The secure connection to #{where} failed (#{e.message})."
      rescue JSON::ParserError
        raise Client::Error, "#{where} did not answer the way an OpenAI-compatible service does."
      end

      def attempt(uri, address, payload, retried)
        connection(uri, address).request(request(uri, payload)) do |response|
          check(response, retried)
          yield response
        end
      end

      def connection(uri, address)
        http = Net::HTTP.new(uri.host, uri.port)
        http.ipaddr = address # an address that was checked is the one used
        http.use_ssl = uri.scheme == "https"
        http.open_timeout = OPEN_TIMEOUT
        http.read_timeout = @config.local? ? LOCAL_READ_TIMEOUT : READ_TIMEOUT
        http
      end

      def request(uri, payload)
        headers = { "Content-Type" => "application/json", "Accept" => "application/json, text/event-stream", "User-Agent" => "FixFlow" }
        headers["Authorization"] = "Bearer #{@config.api_key}" if @config.api_key.present?
        Net::HTTP::Post.new(uri.request_uri, headers).tap { |post| post.body = payload.to_json }
      end

      def check(response, retried)
        return if response.is_a?(Net::HTTPSuccess)

        code = response.code.to_i
        message = error_message(response.read_body)
        raise TokenNameRefused if code == 400 && !retried && message.include?("max_completion_tokens")

        raise Client::Error, refusal(code, message)
      end

      def refusal(code, message)
        case code
        when 401, 403 then "#{where} did not accept the key."
        when 429 then "#{where} says it is busy or the limit was reached. Try again in a minute."
        when 300..399 then "#{where} redirected the request. Use the address it redirects to."
        when 500..599 then "#{where} had a problem (#{code})."
        else "#{where} refused the request (#{code})#{": #{message}" if message.present?}."
        end
      end

      # What the service said was wrong, with the key taken out in case it was quoted back.
      def error_message(body)
        json = JSON.parse(body.to_s)
        error = json.is_a?(Hash) ? json["error"] : nil
        found = error.is_a?(Hash) ? error["message"] : error
        found.is_a?(String) ? scrub(found).truncate(200) : ""
      rescue JSON::ParserError
        ""
      end

      def scrub(text) = @config.api_key.present? ? text.gsub(@config.api_key, "…") : text

      def text_of(body)
        JSON.parse(body.to_s).dig("choices", 0, "message", "content").to_s
      end

      # The answer arrives as server-sent events: lines "data: {json}", ending with "data: [DONE]".
      def read_events(response, &)
        buffer = +"".b
        response.read_body do |chunk|
          buffer << chunk.b
          while (line = buffer.slice!(/\A[^\n]*\n/n))
            event(line.force_encoding(Encoding::UTF_8), &)
          end
        end
        event(buffer.force_encoding(Encoding::UTF_8), &) if buffer.present?
      end

      def event(line)
        data = line.strip
        return unless data.start_with?("data:")

        data = data.delete_prefix("data:").strip
        return if data == "[DONE]" || data.empty?

        json = JSON.parse(data)
        raise Client::Error, "#{where} stopped with an error: #{error_message(data)}" if json["error"]

        delta = json.dig("choices", 0, "delta", "content")
        yield delta if delta.present?
      end

      def where = @config.where || "The AI service"
    end
  end
end
