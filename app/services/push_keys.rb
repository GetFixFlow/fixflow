require "base64"
require "openssl"

# The VAPID keys that sign every push this server sends (they tell the browser vendor's push service which server is
# sending, and let a browser accept messages only from the server it subscribed to). They are made from SECRET_KEY_BASE,
# not stored: there is nothing to set up, nothing to back up beyond the .env that is backed up anyway, and a restored
# server with the same .env signs with the same keys, so the browsers already subscribed keep working. The cost is the
# one every secret derived from SECRET_KEY_BASE has: change it and the keys change, and every browser has to turn push
# on again (a message to a subscription made under other keys is refused, and that subscription is removed).
module PushKeys
  CURVE = "prime256v1".freeze
  # The order of the curve: a private key must be below it.
  ORDER = OpenSSL::PKey::EC::Group.new(CURVE).order

  def self.private_scalar(secret = Rails.application.secret_key_base)
    counter = 0
    loop do
      bytes = OpenSSL::KDF.hkdf(secret.to_s, salt: "fixflow-vapid", info: "p256-#{counter}", length: 32, hash: "SHA256")
      scalar = OpenSSL::BN.new(bytes, 2)
      return bytes if scalar > 0 && scalar < ORDER # rubocop:disable Style/NumericPredicate -- OpenSSL::BN has no positive?

      counter += 1
    end
  end

  # => { public_key:, private_key: } as the unpadded urlsafe base64 a browser and the web-push library use
  def self.pair(secret = Rails.application.secret_key_base)
    private_bytes = private_scalar(secret)
    group = OpenSSL::PKey::EC::Group.new(CURVE)
    point = group.generator.mul(OpenSSL::BN.new(private_bytes, 2))
    { public_key: encode(point.to_octet_string(:uncompressed)), private_key: encode(private_bytes) }
  end

  def self.public_key = pair[:public_key]

  # Who is sending, for the push service to write to if this server misbehaves: the install's own address, else the sender
  # address emails come from.
  def self.subject(env = ENV)
    app_url = env["APP_URL"].to_s
    return app_url if app_url.start_with?("https://")

    "mailto:#{env.fetch('MAILER_FROM', 'noreply@fixflow.dev')}"
  end

  def self.vapid(env = ENV) = pair.merge(subject: subject(env))

  def self.encode(bytes) = Base64.urlsafe_encode64(bytes, padding: false)
end
