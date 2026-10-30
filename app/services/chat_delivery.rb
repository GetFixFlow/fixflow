require "net/http"

# Posts one message to a chat webhook. Redirects are not followed (a webhook answers 200; a redirect is a reason to look
# at the address, not to go where it says), the address is checked again here (a name can start pointing somewhere else),
# and the answer is turned into a sentence for the administrator.
class ChatDelivery
  OPEN_TIMEOUT = 5
  READ_TIMEOUT = 10

  # The webhook did not take it, and trying again will not help: a revoked or mistyped address, or a refused message.
  class Refused < StandardError; end
  # The chat service or the network is having a moment: worth trying again.
  class Unavailable < StandardError; end

  def initialize(config)
    @config = config
  end

  def deliver(content)
    problem = ChatAddress.problem(@config.url)
    raise Refused, "The webhook address #{problem}." if problem

    response = post(ChatMessage.new(@config.kind, content).payload)
    return response if response.is_a?(Net::HTTPSuccess)

    raise Unavailable, "The chat service answered #{response.code}." if response.code.to_i >= 500 || response.code.to_i == 429

    raise Refused, refused_reason(response.code.to_i)
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError, OpenSSL::SSL::SSLError => e
    raise Unavailable, "The chat service could not be reached (#{e.class.name.demodulize})."
  end

  private

  def post(payload)
    uri = URI.parse(@config.url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = OPEN_TIMEOUT
    http.read_timeout = READ_TIMEOUT
    request = Net::HTTP::Post.new(uri.request_uri, "Content-Type" => "application/json")
    request.body = payload.to_json
    http.request(request)
  end

  def refused_reason(code)
    case code
    when 400 then "The chat service did not accept the message (400). For Teams, check the workflow takes an Adaptive Card message."
    when 401, 403 then "The chat service refused the webhook (#{code}). It may have been revoked: make a new one."
    when 404, 410 then "The chat service does not know that webhook address (#{code}). Check it, or make a new one."
    else "The chat service refused the message (#{code})."
    end
  end
end
