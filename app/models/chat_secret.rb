# Keeps the saved chat webhook address unreadable in the database (anyone who has it can post to the company's channel).
# The key comes from the app's secret_key_base, so changing that secret means the address has to be entered again.
module ChatSecret
  def self.encryptor
    ActiveSupport::MessageEncryptor.new(Rails.application.key_generator.generate_key("fixflow chat webhook", 32), cipher: "aes-256-gcm")
  end

  def self.encrypt(plain) = plain.present? ? encryptor.encrypt_and_sign(plain) : nil

  def self.decrypt(cipher)
    cipher.present? ? encryptor.decrypt_and_verify(cipher) : nil
  rescue ActiveSupport::MessageEncryptor::InvalidMessage
    nil
  end
end
