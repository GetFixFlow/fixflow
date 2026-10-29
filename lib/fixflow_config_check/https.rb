class FixflowConfigCheck
  # The optional HTTPS front door (the `https` service of docker-compose.prod.yml, README "HTTPS"). Its settings are
  # in .env, which the api container receives whole, so a mistake can be caught here before the proxy fails to start.
  module Https
    MODES = %w[automatic own-certificate internal].freeze
    DOMAIN = /\A[a-z0-9]([a-z0-9.-]*[a-z0-9])?\z/i
    LOOPBACK = %w[127.0.0.1 localhost ::1].freeze

    private

    def https_settings
      on = value("COMPOSE_PROFILES").split(",").map(&:strip).include?("https")
      return unless on || present?("HTTPS_DOMAIN")

      found = https_domain_problems(on)
      found << https_mode_problem
      found.concat(https_address_problems) if present?("HTTPS_DOMAIN")
      found.compact
    end

    def https_domain_problems(on)
      unless present?("HTTPS_DOMAIN")
        return [problem(:error, "HTTPS_DOMAIN", "is needed when COMPOSE_PROFILES has https: the name people open FixFlow at, " \
                                                "like fixflow.example.com.")]
      end
      found = []
      unless value("HTTPS_DOMAIN").match?(DOMAIN)
        found << problem(:error, "HTTPS_DOMAIN", "is a name only (fixflow.example.com): no https:// in front, no port or path after.")
      end
      unless on
        found << problem(:warning, "HTTPS_DOMAIN", "is set but COMPOSE_PROFILES does not have https in it, so the HTTPS " \
                                                   "front door will not start. Add COMPOSE_PROFILES=https, or remove HTTPS_DOMAIN.")
      end
      found
    end

    def https_mode_problem
      return if !present?("HTTPS_MODE") || MODES.include?(value("HTTPS_MODE"))

      problem(:error, "HTTPS_MODE", "is \"#{value('HTTPS_MODE')}\"; it must be one of #{MODES.join(', ')}.")
    end

    # APP_URL is what emails link to and what the browser's WebSocket origin is checked against, so it has to be the
    # HTTPS address. The plain-HTTP door has to move away from ports 80 and 443, which the https service takes.
    def https_address_problems
      found = []
      uri = uri_for("APP_URL", %w[http https])
      if uri && (uri.scheme != "https" || !uri.host.casecmp?(value("HTTPS_DOMAIN")))
        found << problem(:error, "APP_URL", "must be https://#{value('HTTPS_DOMAIN')} when HTTPS_DOMAIN is set " \
                                            "(it is #{value('APP_URL')}).")
      end
      port = value("HTTP_PORT")
      if port.empty? || %w[80 443].include?(port)
        found << problem(:error, "HTTP_PORT", "must be another port, such as 8080, when HTTPS_DOMAIN is set: the HTTPS front " \
                                              "door takes ports 80 and 443.")
      end
      unless LOOPBACK.include?(value("HTTP_BIND"))
        found << problem(:warning, "HTTP_BIND", "is not 127.0.0.1, so the plain-HTTP door on HTTP_PORT is still open to the " \
                                                "network and sign-in tokens can cross it unencrypted. Set HTTP_BIND=127.0.0.1.")
      end
      found
    end
  end
end
