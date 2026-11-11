# Keeps the signing secret of each webhook unreadable in the database (anyone who has it can sign a message as FixFlow).
# The key comes from the app's secret_key_base, so changing that secret means the secrets have to be made again.
module WebhookSecret
  PREFIX = "whsec_".freeze

  def self.encryptor
    ActiveSupport::MessageEncryptor.new(Rails.application.key_generator.generate_key("fixflow webhook secrets", 32),
cipher: "aes-256-gcm")
  end

  def self.generate = "#{PREFIX}#{SecureRandom.hex(24)}"

  def self.encrypt(plain) = plain.present? ? encryptor.encrypt_and_sign(plain) : nil

  def self.decrypt(cipher)
    cipher.present? ? encryptor.decrypt_and_verify(cipher) : nil
  rescue ActiveSupport::MessageEncryptor::InvalidMessage
    nil
  end
end
