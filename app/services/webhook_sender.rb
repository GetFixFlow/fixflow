require "net/http"
require "openssl"

# Sends one delivery to its webhook, once, and says what happened. The message is signed: the header
#
#   X-FixFlow-Signature: t=1700000000,v1=<hex>
#
# holds the time and an HMAC-SHA256 of "<time>.<body>" made with the webhook's secret, so a receiver can check who sent it and
# refuse an old one. Redirects are not followed (a webhook answers 2xx; a redirect is a reason to look at the address). The
# address is checked again here, and the connection goes to the address that was checked.
class WebhookSender
  OPEN_TIMEOUT = 5
  READ_TIMEOUT = 10
  EXCERPT = 500

  Result = Struct.new(:ok, :code, :excerpt, :error, :gone, keyword_init: true)

  def self.signature(secret, body, time) = "t=#{time},v1=#{OpenSSL::HMAC.hexdigest('SHA256', secret, "#{time}.#{body}")}"

  def initialize(delivery)
    @delivery = delivery
    @webhook = delivery.webhook
  end

  def deliver
    problem = WebhookAddress.problem(@webhook.url)
    return failure("The address #{problem}.") if problem

    uri = URI.parse(@webhook.url)
    response = post(uri, WebhookAddress.addresses_for(uri.host).first)
    code = response.code.to_i
    Result.new(ok: response.is_a?(Net::HTTPSuccess), code: code, excerpt: response.body.to_s.scrub.first(EXCERPT),
               error: response.is_a?(Net::HTTPSuccess) ? nil : "The receiver answered #{code}.", gone: code == 410)
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError, OpenSSL::SSL::SSLError, IOError => e
    failure("Could not reach the receiver (#{e.class.name.demodulize}).")
  end

  private

  def failure(message) = Result.new(ok: false, code: nil, excerpt: nil, error: message, gone: false)

  def post(uri, ip)
    body = @delivery.body
    http = Net::HTTP.new(uri.host, uri.port)
    http.ipaddr = ip if ip # connect to the address that was checked; the name is still used for the certificate
    http.use_ssl = uri.scheme == "https"
    http.open_timeout = OPEN_TIMEOUT
    http.read_timeout = READ_TIMEOUT
    request = Net::HTTP::Post.new(uri.request_uri, headers(body))
    request.body = body
    http.request(request)
  end

  def headers(body)
    {
      "Content-Type" => "application/json",
      "User-Agent" => "FixFlow-Webhooks/1",
      "X-FixFlow-Event" => @delivery.event,
      "X-FixFlow-Delivery" => @delivery.event_id,
      "X-FixFlow-Attempt" => (@delivery.attempts + 1).to_s,
      "X-FixFlow-Signature" => self.class.signature(@webhook.secret.to_s, body, Time.current.to_i)
    }
  end
end
