# A stand-in for a company's OpenID Connect provider (Keycloak, Entra...): its settings document, its keys, and the
# token endpoint, answered through WebMock, with ID tokens signed by a key of our own.
module DirectoryHelpers
  ISSUER = "https://idp.example.test/realms/acme".freeze
  CLIENT_ID = "fixflow".freeze

  class FakeProvider
    attr_reader :key, :kid

    def initialize(issuer: ISSUER, client_id: CLIENT_ID)
      @issuer = issuer
      @client_id = client_id
      @kid = "key-1"
      @key = OpenSSL::PKey::RSA.generate(2048)
    end

    def jwks(key: @key, kid: @kid)
      { "keys" => [JWT::JWK.new(key, kid: kid, use: "sig").export.merge("alg" => "RS256")] }
    end

    def discovery(extra = {})
      { "issuer" => @issuer, "authorization_endpoint" => "#{@issuer}/protocol/openid-connect/auth",
        "token_endpoint" => "#{@issuer}/protocol/openid-connect/token", "jwks_uri" => "#{@issuer}/protocol/openid-connect/certs",
        "userinfo_endpoint" => "#{@issuer}/protocol/openid-connect/userinfo",
        "token_endpoint_auth_methods_supported" => %w[client_secret_basic client_secret_post] }.merge(extra)
    end

    def claims(nonce:, **overrides)
      { "iss" => @issuer, "aud" => @client_id, "sub" => "sub-1", "exp" => 5.minutes.from_now.to_i, "iat" => Time.now.to_i,
        "nonce" => nonce, "email" => "sam@example.test", "email_verified" => true, "given_name" => "Sam",
        "family_name" => "Rivera", "groups" => ["fixflow-technicians"] }
        .merge(overrides.stringify_keys).compact # a claim set to nil is one the provider leaves out
    end

    def id_token(nonce:, key: @key, kid: @kid, alg: "RS256", **overrides)
      JWT.encode(claims(nonce: nonce, **overrides), key, alg, { kid: kid })
    end
  end

  def fake_provider = @fake_provider ||= FakeProvider.new

  # Answers the provider's settings document and keys; the token endpoint answers with `id_token`.
  def stub_provider(id_token: nil, token_status: 200, userinfo: nil, discovery: {})
    provider = fake_provider
    stub_request(:get, "#{DirectoryHelpers::ISSUER}/.well-known/openid-configuration")
      .to_return(status: 200, body: provider.discovery(discovery).to_json, headers: { "Content-Type" => "application/json" })
    stub_request(:get, provider.discovery["jwks_uri"]).to_return(status: 200, body: provider.jwks.to_json)
    if id_token || token_status != 200
      body = if token_status == 200
               { "id_token" => id_token, "access_token" => "at-1",
             "token_type" => "Bearer" }
             else
               { "error" => "invalid_grant" }
             end
      stub_request(:post, provider.discovery["token_endpoint"]).to_return(status: token_status, body: body.to_json)
    end
    stub_request(:get, provider.discovery["userinfo_endpoint"]).to_return(status: 200, body: userinfo.to_json) if userinfo
    provider
  end

  def oidc_settings(**overrides)
    DirectorySettings.new({ oidc_enabled: true, oidc_issuer: DirectoryHelpers::ISSUER, oidc_client_id: DirectoryHelpers::CLIENT_ID,
                            oidc_client_secret: "s3cret",
                            role_groups: { "technician" => ["fixflow-technicians"], "admin" => ["fixflow-admins"] } }.merge(overrides))
  end

  def save_directory_settings(organization, **overrides)
    oidc_settings(**overrides).save_to(organization)
  end
end

RSpec.configure { |config| config.include DirectoryHelpers }
