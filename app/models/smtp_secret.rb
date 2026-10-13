# Keeps the saved mail password unreadable in the database. The key comes from the app's
# secret_key_base, so changing that secret means the password has to be entered again.
module SmtpSecret
  def self.encryptor
    ActiveSupport::MessageEncryptor.new(Rails.application.key_generator.generate_key("fixflow smtp password", 32),
cipher: "aes-256-gcm")
  end

  def self.encrypt(plain) = plain.present? ? encryptor.encrypt_and_sign(plain) : nil

  def self.decrypt(cipher)
    cipher.present? ? encryptor.decrypt_and_verify(cipher) : nil
  rescue ActiveSupport::MessageEncryptor::InvalidMessage
    nil
  end
end
