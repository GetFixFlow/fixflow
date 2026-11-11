require "rails_helper"

RSpec.describe Directory::Oidc do
  let(:settings) { oidc_settings }
  let(:oidc) { described_class.new(settings) }
  let(:nonce) { "nonce-123" }

  def identity(token: fake_provider.id_token(nonce: nonce), **opts)
    stub_provider(id_token: token, **opts)
    oidc.identity_for(code: "code-1", code_verifier: "verifier-1", nonce: nonce)
  end

  describe "#authorization_url" do
    it "sends the person to the provider with a code flow, PKCE, a state and a nonce" do
      stub_provider
      url = oidc.authorization_url(state: "st", nonce: "no", code_challenge: "ch")
      query = Rack::Utils.parse_query(URI.parse(url).query)

      expect(url).to start_with("#{DirectoryHelpers::ISSUER}/protocol/openid-connect/auth?")
      expect(query).to include("response_type" => "code", "client_id" => "fixflow", "state" => "st", "nonce" => "no",
                               "code_challenge" => "ch", "code_challenge_method" => "S256", "scope" => "openid email profile")
      expect(query["redirect_uri"]).to eq(oidc.callback_url)
    end

    it "registers the callback under the API address (API_URL, or the web address)" do
      stub_const("ENV", ENV.to_h.merge("API_URL" => "https://api.acme.test/"))

      expect(oidc.callback_url).to eq("https://api.acme.test/api/v1/auth/oidc/callback")
    end
  end

  describe "#identity_for" do
    it "returns who the provider vouches for, with the groups" do
      result = identity

      expect(result).to have_attributes(provider: "oidc", subject: "sub-1", email: "sam@example.test", first_name: "Sam",
                                        last_name: "Rivera", groups: ["fixflow-technicians"], email_verified: true)
    end

    it "sends the client secret with HTTP basic authentication and the PKCE verifier, when the provider takes it" do
      identity

      expect(a_request(:post, fake_provider.discovery["token_endpoint"])
        .with(headers: { "Authorization" => "Basic #{Base64.strict_encode64('fixflow:s3cret')}" },
              body: hash_including("grant_type" => "authorization_code", "code" => "code-1", "code_verifier" => "verifier-1",
                                   "redirect_uri" => oidc.callback_url))).to have_been_made
    end

    it "sends the secret in the body when the provider only takes that" do
      identity(discovery: { "token_endpoint_auth_methods_supported" => ["client_secret_post"] })

      expect(a_request(:post, fake_provider.discovery["token_endpoint"])
        .with(body: hash_including("client_id" => "fixflow", "client_secret" => "s3cret"))).to have_been_made
    end

    it "refuses a token signed by a key the provider never published" do
      forged = fake_provider.id_token(nonce: nonce, key: OpenSSL::PKey::RSA.generate(2048))

      expect { identity(token: forged) }.to raise_error(Directory::Refused) { |e| expect(e.code).to eq(:failed) }
    end

    it "refuses a token meant for another application" do
      expect { identity(token: fake_provider.id_token(nonce: nonce, aud: "someone-else")) }.to raise_error(Directory::Refused)
    end

    it "refuses a token from another issuer" do
      expect { identity(token: fake_provider.id_token(nonce: nonce, iss: "https://evil.example.test")) }.to raise_error(Directory::Refused)
    end

    it "refuses an expired token, allowing a minute of clock difference" do
      expect { identity(token: fake_provider.id_token(nonce: nonce, exp: 5.minutes.ago.to_i)) }.to raise_error(Directory::Refused)
      expect(identity(token: fake_provider.id_token(nonce: nonce, exp: 30.seconds.ago.to_i)).email).to eq("sam@example.test")
    end

    it "refuses a token for another sign-in (wrong nonce), or without a nonce" do
      expect { identity(token: fake_provider.id_token(nonce: "another")) }.to raise_error(Directory::Refused, /nonce/)
      expect { identity(token: fake_provider.id_token(nonce: nil)) }.to raise_error(Directory::Refused, /nonce/)
    end

    it "refuses a token that says it is unsigned, or signed with a shared secret" do
      unsigned = JWT.encode(fake_provider.claims(nonce: nonce), nil, "none")
      hs256 = JWT.encode(fake_provider.claims(nonce: nonce), "s3cret", "HS256", { kid: "key-1" })

      expect { identity(token: unsigned) }.to raise_error(Directory::Refused)
      expect { identity(token: hs256) }.to raise_error(Directory::Refused)
    end

    it "refuses a token with several audiences when it was not issued to this client" do
      token = fake_provider.id_token(nonce: nonce, aud: %w[fixflow other], azp: "other")

      expect { identity(token: token) }.to raise_error(Directory::Refused, /another application/)
    end

    it "finds the key again when the provider has rotated its keys" do
      rotated = OpenSSL::PKey::RSA.generate(2048)
      token = fake_provider.id_token(nonce: nonce, key: rotated, kid: "key-2")
      stub_provider(id_token: token)
      stub_request(:get, fake_provider.discovery["jwks_uri"])
        .to_return({ status: 200,
body: fake_provider.jwks.to_json }, { status: 200, body: fake_provider.jwks(key: rotated, kid: "key-2").to_json })

      expect(oidc.identity_for(code: "c", code_verifier: "v", nonce: nonce).email).to eq("sam@example.test")
    end

    it "is refused when the provider refuses the code" do
      stub_provider(token_status: 400)

      expect { oidc.identity_for(code: "c", code_verifier: "v", nonce: nonce) }.to raise_error(Directory::Refused, /refused the code/)
    end

    it "takes the email and the groups from the userinfo endpoint when the token has neither" do
      token = fake_provider.id_token(nonce: nonce, email: nil, groups: nil)
      result = identity(token: token, userinfo: { "email" => "pat@example.test", "groups" => ["fixflow-admins"] })

      expect(result).to have_attributes(email: "pat@example.test", groups: ["fixflow-admins"])
    end

    it "falls back to the user principal name, as Microsoft Entra gives it, when there is no email claim" do
      entra = fake_provider.id_token(nonce: nonce, email: nil, email_verified: nil, preferred_username: "sam@acme.onmicrosoft.com",
groups: ["g"])

      expect(identity(token: entra)).to have_attributes(email: "sam@acme.onmicrosoft.com", email_verified: nil)
    end

    it "does not take a preferred username that is not an email address for one" do
      token = fake_provider.id_token(nonce: nonce, email: nil, preferred_username: "sam")

      expect { identity(token: token, userinfo: {}) }.to raise_error(Directory::Refused, /email/)
    end

    it "reads the groups from the claim the company named (Entra's app roles come as roles)" do
      stub_provider(id_token: fake_provider.id_token(nonce: nonce, roles: ["Admin"]))
      oidc = described_class.new(oidc_settings(oidc_groups_claim: "roles"))

      expect(oidc.identity_for(code: "c", code_verifier: "v", nonce: nonce).groups).to eq(["Admin"])
    end

    it "does not take a name from the full name when there are given and family names" do
      expect(identity(token: fake_provider.id_token(nonce: nonce, name: "Someone Else")).last_name).to eq("Rivera")
    end

    it "splits the full name when there are no given and family names" do
      token = fake_provider.id_token(nonce: nonce, given_name: nil, family_name: nil, name: "Pat Q. Lee")

      expect(identity(token: token)).to have_attributes(first_name: "Pat", last_name: "Q. Lee")
    end
  end

  describe "#discovery" do
    it "refuses a provider that names a different issuer than the one set up" do
      stub_provider(discovery: { "issuer" => "https://other.example.test" })

      expect { oidc.discovery }.to raise_error(Directory::Error, /issuer/)
    end

    it "says so when the provider cannot be reached, or does not answer" do
      stub_request(:get, "#{DirectoryHelpers::ISSUER}/.well-known/openid-configuration").to_timeout
      expect { oidc.discovery }.to raise_error(Directory::Error, /Could not reach/)

      stub_request(:get, "#{DirectoryHelpers::ISSUER}/.well-known/openid-configuration").to_return(status: 404)
      expect { described_class.new(settings).discovery }.to raise_error(Directory::Error, /404/)
    end

    it "does not talk to a provider over plain http, unless it is on this computer" do
      expect { described_class.new(oidc_settings(oidc_issuer: "http://idp.example.test/realms/acme")).discovery }
        .to raise_error(Directory::Error, /not an https address/)
    end
  end

  describe "#check" do
    it "reports the provider's endpoints, how many keys it publishes, and the address to register" do
      stub_provider
      report = oidc.check

      expect(report).to include(issuer: DirectoryHelpers::ISSUER, keys: 1, redirect_uri: oidc.callback_url, pkce: true)
    end
  end
end
