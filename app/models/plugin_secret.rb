# Keeps the secrets a plugin's channel asks for (tokens, passwords) unreadable in the database. The key comes from the app's
# secret_key_base, so changing that secret means they have to be entered again.
module PluginSecret
  def self.encryptor
    ActiveSupport::MessageEncryptor.new(Rails.application.key_generator.generate_key("fixflow plugin secret", 32),
cipher: "aes-256-gcm")
  end

  def self.encrypt(plain) = plain.present? ? encryptor.encrypt_and_sign(plain) : nil

  def self.decrypt(cipher)
    cipher.present? ? encryptor.decrypt_and_verify(cipher) : nil
  rescue ActiveSupport::MessageEncryptor::InvalidMessage
    nil
  end
end
