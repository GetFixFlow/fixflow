require "net/http"

module Plugins
  # The way for a channel to post to another service, with the care FixFlow's own webhooks take: the address is checked (not
  # this server, not a link-local or metadata address) when it is used, the connection goes to the address that was checked,
  # redirects are not followed, and there are time limits. A plugin that talks to the network should use this.
  #
  #   Plugins::Http.post("https://ntfy.sh/my-topic", body: "Pump 3 is down", headers: { "Title" => "Sensor alert" })
  #
  # Returns the response when the service accepts it (2xx). Raises Plugins::Unavailable when it is worth trying again (the
  # service is down, slow, or says 429 or 5xx) and Plugins::Refused when it is not (4xx, a refused address).
  module Http
    OPEN_TIMEOUT = 5
    READ_TIMEOUT = 10

    module_function

    def post(url, body: "", headers: {}, json: false)
      problem = WebhookAddress.problem(url)
      raise Refused, "The address #{problem}." if problem

      uri = URI.parse(url)
      request = Net::HTTP::Post.new(uri.request_uri, { "User-Agent" => "FixFlow-Plugin/1" }.merge(headers.to_h.to_h { |name, value|
        [name.to_s, value.to_s]
      }))
      request["Content-Type"] ||= "application/json" if json
      request.body = json ? body.to_json : body.to_s
      answer(connection(uri).request(request))
    end

    def connection(uri)
      http = Net::HTTP.new(uri.host, uri.port)
      http.ipaddr = WebhookAddress.addresses_for(uri.host).first # the address that was checked is the one used
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = OPEN_TIMEOUT
      http.read_timeout = READ_TIMEOUT
      http
    end

    def answer(response)
      code = response.code.to_i
      return response if response.is_a?(Net::HTTPSuccess)
      raise Unavailable, "The service answered #{code}." if code >= 500 || code == 429

      raise Refused, "The service refused the message (#{code})#{refusal_hint(code)}."
    end

    def refusal_hint(code)
      case code
      when 401, 403 then ": the login or token was not accepted"
      when 404, 410 then ": it does not know that address"
      else ""
      end
    end
  end
end
