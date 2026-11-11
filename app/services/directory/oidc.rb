module Directory
  # Signing in with OpenID Connect (the authorization code flow with PKCE): the address to send a person to, and what
  # to do with the code the provider sends them back with. The identity token is checked in full: its signature
  # against the provider's published keys, who issued it, who it is for, that it has not expired, and that it answers
  # this very sign-in (the nonce). Nothing from the token is trusted before that.
  class Oidc
    ALGORITHMS = %w[RS256 RS384 RS512 PS256 PS384 PS512 ES256 ES384 ES512].freeze
    LEEWAY = 60
    EMAIL_FALLBACKS = %w[email preferred_username upn].freeze

    def initialize(settings)
      @settings = settings
    end

    def callback_url = "#{Directory.api_url}/api/v1/auth/oidc/callback"

    # The provider's published description of itself. Its issuer must be exactly the one set up here.
    def discovery
      @discovery ||= begin
        status, json = Http.get_json("#{@settings.oidc_issuer.chomp('/')}/.well-known/openid-configuration")
        unless status == 200 && json.is_a?(Hash)
          raise Error,
"The provider answered #{status} when asked for its settings. Is the issuer address right?"
        end
        unless json["issuer"].to_s.chomp("/") == @settings.oidc_issuer.chomp("/")
          raise Error, "The provider says its issuer is #{json['issuer'].inspect}, not #{@settings.oidc_issuer.inspect}"
        end
        %w[authorization_endpoint token_endpoint jwks_uri].each { |k|
          raise Error, "The provider's settings have no #{k}" if json[k].blank?
        }
        json
      end
    end

    def authorization_url(state:, nonce:, code_challenge:)
      query = { response_type: "code", client_id: @settings.oidc_client_id, redirect_uri: callback_url,
                scope: @settings.oidc_scopes.presence || "openid email profile", state: state, nonce: nonce,
                code_challenge: code_challenge, code_challenge_method: "S256" }.to_query
      "#{discovery['authorization_endpoint']}#{discovery['authorization_endpoint'].include?('?') ? '&' : '?'}#{query}"
    end

    # The person the provider vouches for, from the code it sent back. Raises Refused for a sign-in that does not hold up.
    def identity_for(code:, code_verifier:, nonce:)
      tokens = exchange(code, code_verifier)
      claims = verify_id_token(tokens["id_token"], nonce)
      if needs_userinfo?(claims)
        claims = claims.merge(userinfo(tokens["access_token"]).slice(*wanted_claims).reject { |k, _|
          claims.key?(k)
        })
      end
      identity_from(claims)
    end

    # What Settings' "Check" shows: the provider answers, with these endpoints, and its keys can be fetched.
    def check
      d = discovery
      status, keys = Http.get_json(d["jwks_uri"])
      unless status == 200 && keys.is_a?(Hash) && Array(keys["keys"]).any?
        raise Error,
"The provider's keys could not be fetched (#{status})"
      end

      { issuer: d["issuer"], authorization_endpoint: d["authorization_endpoint"], token_endpoint: d["token_endpoint"],
        userinfo_endpoint: d["userinfo_endpoint"], keys: keys["keys"].size, redirect_uri: callback_url,
        pkce: Array(d["code_challenge_methods_supported"]).include?("S256") || d["code_challenge_methods_supported"].nil? }
    end

    private

    def exchange(code, code_verifier)
      form = { grant_type: "authorization_code", code: code, redirect_uri: callback_url, code_verifier: code_verifier }
      headers = {}
      secret = @settings.oidc_client_secret.to_s
      if secret.present? && basic_auth?
        headers["Authorization"] = "Basic #{Base64.strict_encode64("#{CGI.escape(@settings.oidc_client_id)}:#{CGI.escape(secret)}")}"
      else
        form[:client_id] = @settings.oidc_client_id
        form[:client_secret] = secret if secret.present?
      end
      status, json = Http.post_form(discovery["token_endpoint"], form, headers: headers)
      unless status == 200 && json.is_a?(Hash) && json["id_token"].present?
        raise Refused.new(:failed, "The provider refused the code (#{status}: #{json.is_a?(Hash) ? json['error'] : 'no answer'})")
      end

      json
    end

    # client_secret_basic is the default when the provider does not say what it takes.
    def basic_auth?
      methods = Array(discovery["token_endpoint_auth_methods_supported"])
      methods.empty? || methods.include?("client_secret_basic")
    end

    def verify_id_token(token, nonce)
      header = JWT::EncodedToken.new(token.to_s).header
      alg = header["alg"].to_s
      raise Refused.new(:failed, "The identity token uses #{alg.inspect}, which is not accepted") unless ALGORITHMS.include?(alg)

      claims, = JWT.decode(token, nil, true, algorithms: ALGORITHMS, jwks: ->(options) { jwks(force: options[:invalidate]) },
                           iss: discovery["issuer"], verify_iss: true, aud: @settings.oidc_client_id, verify_aud: true,
                           verify_expiration: true, exp_leeway: LEEWAY, verify_not_before: true, nbf_leeway: LEEWAY)
      raise Refused.new(:failed, "The identity token is for a different sign-in (nonce)") unless secure_equal?(claims["nonce"], nonce)
      if Array(claims["aud"]).size > 1 && claims["azp"] != @settings.oidc_client_id
        raise Refused.new(:failed, "The identity token was issued to another application")
      end

      claims
    rescue JWT::DecodeError => e
      raise Refused.new(:failed, "The identity token was not accepted: #{e.message}")
    end

    def jwks(force: false)
      Rails.cache.delete(jwks_key) if force
      keys = Rails.cache.fetch(jwks_key, expires_in: 10.minutes) do
        status, json = Http.get_json(discovery["jwks_uri"])
        raise Error, "The provider's keys could not be fetched (#{status})" unless status == 200 && json.is_a?(Hash)

        json
      end
      # Only keys that verify a signature: a provider may publish encryption keys beside them (Keycloak does).
      { "keys" => Array(keys["keys"]).select { |k| k.is_a?(Hash) && k["use"] != "enc" && %w[RSA EC].include?(k["kty"]) } }
    end

    def jwks_key = "directory/jwks/#{Digest::SHA256.hexdigest(@settings.oidc_issuer)}"

    def secure_equal?(given, expected)
      given.is_a?(String) && expected.is_a?(String) && given.present? && ActiveSupport::SecurityUtils.secure_compare(given, expected)
    end

    def wanted_claims = [*EMAIL_FALLBACKS, "email_verified", "given_name", "family_name", "name", "sub", @settings.oidc_groups_claim]

    def needs_userinfo?(claims)
      discovery["userinfo_endpoint"].present? && (email_from(claims).blank? || !claims.key?(@settings.oidc_groups_claim))
    end

    def userinfo(access_token)
      return {} if access_token.blank?

      status, json = Http.get_json(discovery["userinfo_endpoint"], headers: { "Authorization" => "Bearer #{access_token}" })
      status == 200 && json.is_a?(Hash) ? json : {}
    rescue Error
      {}
    end

    def email_from(claims)
      EMAIL_FALLBACKS.filter_map { |k|
        claims[k].to_s.strip.presence if k != "preferred_username" || claims[k].to_s.include?("@")
      }.first
    end

    def identity_from(claims)
      email = email_from(claims)
      raise Refused.new(:failed, "The provider did not say the person's email address") if email.blank?

      first = claims["given_name"].to_s
      last = claims["family_name"].to_s
      first, last = claims["name"].to_s.split(/\s+/, 2) if first.blank? && last.blank?
      Identity.new(provider: "oidc", subject: claims["sub"], email: email, first_name: first, last_name: last,
                   groups: Array(claims[@settings.oidc_groups_claim]),
                   email_verified: claims.key?("email_verified") ? [true, "true"].include?(claims["email_verified"]) : nil)
    end
  end
end
