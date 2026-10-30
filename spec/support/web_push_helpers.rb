require "base64"
require "openssl"

# A browser, for the specs of push notifications: it makes the subscription a real browser would (a P-256 key pair and an
# auth secret), and reads what the server sent the way a browser does (RFC 8291, aes128gcm), so a spec proves the message
# is readable by the one it was meant for, not just that a request was made.
module WebPushHelpers
  class FakeBrowser
    attr_reader :endpoint, :auth_secret

    def initialize(endpoint: "https://push.example.test/send/#{SecureRandom.hex(8)}")
      @endpoint = endpoint
      @key = OpenSSL::PKey::EC.generate("prime256v1")
      @auth_secret = SecureRandom.random_bytes(16)
    end

    def public_bytes = @key.public_key.to_octet_string(:uncompressed)
    def p256dh = Base64.urlsafe_encode64(public_bytes, padding: false)
    def auth = Base64.urlsafe_encode64(auth_secret, padding: false)

    # What PushSubscription.toJSON() gives a page.
    def subscription_json = { endpoint: endpoint, keys: { p256dh: p256dh, auth: auth } }

    # The text the server encrypted for this browser.
    def decrypt(body)
      salt = body.byteslice(0, 16)
      id_length = body.getbyte(20)
      server_public = body.byteslice(21, id_length)
      ciphertext = body.byteslice((21 + id_length)..)

      group = @key.group
      point = OpenSSL::PKey::EC::Point.new(group, OpenSSL::BN.new(server_public, 2))
      secret = @key.dh_compute_key(point)
      key_info = "WebPush: info\0".b + public_bytes + server_public
      ikm = OpenSSL::KDF.hkdf(secret, salt: auth_secret, info: key_info, length: 32, hash: "SHA256")
      cek = OpenSSL::KDF.hkdf(ikm, salt: salt, info: "Content-Encoding: aes128gcm\0", length: 16, hash: "SHA256")
      nonce = OpenSSL::KDF.hkdf(ikm, salt: salt, info: "Content-Encoding: nonce\0", length: 12, hash: "SHA256")

      cipher = OpenSSL::Cipher.new("aes-128-gcm").decrypt
      cipher.key = cek
      cipher.iv = nonce
      cipher.auth_tag = ciphertext.byteslice(-16, 16)
      plain = cipher.update(ciphertext.byteslice(0, ciphertext.bytesize - 16)) + cipher.final
      plain.sub(/\x02\x00*\z/n, "").force_encoding(Encoding::UTF_8)
    end
  end

  def fake_browser(**) = FakeBrowser.new(**)

  # Every push service name in a spec resolves to a public address, so no spec waits for DNS.
  def stub_push_dns(address = "203.0.113.10")
    allow(Resolv).to receive(:getaddresses).and_return([address])
  end

  # The public key in a "vapid t=<token>,k=<key>" header as a key the JWT library can verify with.
  def vapid_public_key(header)
    bytes = Base64.urlsafe_decode64(header[/k=([^,\s]+)/, 1])
    algorithm = OpenSSL::ASN1::Sequence([OpenSSL::ASN1::ObjectId("id-ecPublicKey"), OpenSSL::ASN1::ObjectId("prime256v1")])
    OpenSSL::PKey.read(OpenSSL::ASN1::Sequence([algorithm, OpenSSL::ASN1::BitString(bytes)]).to_der)
  end
end

RSpec.configure { |config| config.include WebPushHelpers }
