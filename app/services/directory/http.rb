require "net/http"

module Directory
  # The few web requests sign-in makes to the identity provider (its settings, its keys, the code exchange). Timeouts are
  # short, answers are capped, and an address that is not https is refused unless it is on this computer, so a typing
  # mistake in Settings cannot send a client secret across the open internet.
  module Http
    TIMEOUT = 8
    MAX_BYTES = 1_000_000
    LOCAL_HOSTS = %w[localhost 127.0.0.1 ::1 [::1]].freeze

    module_function

    def get_json(url, headers: {})
      request(Net::HTTP::Get.new(uri_for(url)), headers)
    end

    def post_form(url, form, headers: {})
      request = Net::HTTP::Post.new(uri_for(url))
      request.set_form_data(form)
      request(request, headers)
    end

    def uri_for(url)
      uri = URI.parse(url.to_s)
      local = uri.is_a?(URI::HTTP) && LOCAL_HOSTS.include?(uri.host)
      raise Directory::Error, "#{url} is not an https address" unless uri.is_a?(URI::HTTPS) || local

      uri
    rescue URI::InvalidURIError
      raise Directory::Error, "#{url} is not a web address"
    end

    def request(request, headers)
      uri = request.uri
      headers.each { |name, value| request[name] = value }
      request["Accept"] = "application/json"
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: TIMEOUT,
                                                     read_timeout: TIMEOUT, write_timeout: TIMEOUT) { |http| http.request(request) }
      body = response.body.to_s.byteslice(0, MAX_BYTES)
      json = begin
        JSON.parse(body)
      rescue JSON::ParserError
        nil
      end
      [response.code.to_i, json]
    rescue SocketError, SystemCallError, Timeout::Error, OpenSSL::SSL::SSLError, IOError => e
      raise Directory::Error, "Could not reach #{request.uri.host}: #{e.message}"
    end
  end
end
