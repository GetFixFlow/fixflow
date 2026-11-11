# API keys for the specs of the public API (/api/v1/open) and what a program sends with one.
module PublicApiHelpers
  # => [the ApiKey, its secret]
  def make_key(organization, scopes: %w[read], **attributes)
    raw, digest = ApiKey.generate
    key = create(:api_key, organization: organization, key_digest: digest, key_hint: ApiKey.hint_for(raw), scopes: scopes,
name: "Zapier", **attributes)
    [key, raw]
  end

  def bearer(raw) = { "Authorization" => "Bearer #{raw}" }
end

RSpec.configure { |config| config.include PublicApiHelpers }
