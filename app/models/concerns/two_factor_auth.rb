require "rotp"

# Two-factor sign-in with an authenticator app (TOTP, RFC 6238), plus one-time recovery codes for a lost phone.
#
# The secret is stored encrypted with a key derived from SECRET_KEY_BASE, which every install already keeps safe (and
# which the JWT secret does not depend on); the recovery codes only as HMAC digests. Setting up has two steps, so a
# secret nobody has proved they can read is never switched on: start (a secret is made, shown as a QR code) and
# enable (the first code from the app proves it was scanned).
module TwoFactorAuth
  extend ActiveSupport::Concern

  ISSUER = "FixFlow".freeze
  RECOVERY_CODE_COUNT = 10
  MAX_FAILURES = 5
  LOCK_FOR = 15.minutes
  DRIFT = 30 # seconds either side of now that a code from the app is still accepted

  # Too many wrong codes in a row: no more tries until `until`.
  class Locked < StandardError
    attr_reader :until

    def initialize(until_time)
      @until = until_time
      super("Too many wrong codes. Try again after #{until_time.utc.strftime('%H:%M UTC')}.")
    end
  end

  def self.encryptor
    key = Rails.application.key_generator.generate_key("fixflow two-factor secret", ActiveSupport::MessageEncryptor.key_len)
    ActiveSupport::MessageEncryptor.new(key, cipher: "aes-256-gcm")
  end

  def self.digest(code)
    OpenSSL::HMAC.hexdigest("SHA256", Rails.application.key_generator.generate_key("fixflow recovery codes", 32), code)
  end

  # Recovery codes look like "k3x9d-7qm2w": letters and digits that cannot be mistaken for each other.
  def self.recovery_code
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789".chars
    "#{Array.new(5) { alphabet.sample(random: SecureRandom) }.join}-#{Array.new(5) { alphabet.sample(random: SecureRandom) }.join}"
  end

  def two_factor_enabled? = otp_enabled_at.present?

  # A secret was made but the first code has not been entered yet.
  def two_factor_pending? = otp_secret_ciphertext.present? && !two_factor_enabled?

  def recovery_codes_left = otp_recovery_digests.size

  def two_factor_locked? = otp_locked_until.present? && otp_locked_until.future?

  # Makes (or replaces, if it was never switched on) the secret. Returns the address an authenticator app reads.
  def start_two_factor_setup!
    raise ArgumentError, "Two-factor sign-in is already on." if two_factor_enabled?

    update!(otp_secret_ciphertext: TwoFactorAuth.encryptor.encrypt_and_sign(ROTP::Base32.random), otp_last_step: nil)
    two_factor_setup_details
  end

  # What the setup screen shows for a pending secret: the address for the QR code, and the key to type by hand.
  def two_factor_setup_details
    return unless two_factor_pending?

    { secret: two_factor_secret, otpauth_uri: totp.provisioning_uri(email) }
  end

  # Switches it on when `code` is right for the pending secret. Returns the recovery codes (shown once), or nil.
  def enable_two_factor!(code)
    return unless two_factor_pending?

    with_lock do
      step = match_totp(code)
      next unless step

      codes = Array.new(RECOVERY_CODE_COUNT) { TwoFactorAuth.recovery_code }
      update!(otp_enabled_at: Time.current, otp_last_step: step, otp_recovery_digests: codes.map { |c| TwoFactorAuth.digest(c) },
              otp_failed_attempts: 0, otp_locked_until: nil)
      codes
    end
  end

  # The second step of signing in, and the check before turning it off: a code from the app, or a recovery code
  # (which works once). Returns :code or :recovery_code when it was right, false when it was not. Counts a wrong
  # answer, and raises Locked after MAX_FAILURES of them in a row.
  def verify_second_factor!(input)
    with_lock do
      raise Locked, otp_locked_until if two_factor_locked?

      accepted = two_factor_enabled? && consume_second_factor(input.to_s.strip.downcase.delete(" "))
      if accepted
        update!(otp_failed_attempts: 0, otp_locked_until: nil)
      else
        failures = otp_failed_attempts + 1
        update!(otp_failed_attempts: failures, otp_locked_until: (LOCK_FOR.from_now if failures >= MAX_FAILURES))
      end
      accepted
    end
  end

  # Ten new recovery codes; the old ones stop working.
  def regenerate_recovery_codes!
    codes = Array.new(RECOVERY_CODE_COUNT) { TwoFactorAuth.recovery_code }
    update!(otp_recovery_digests: codes.map { |c| TwoFactorAuth.digest(c) })
    codes
  end

  def disable_two_factor!
    update!(otp_secret_ciphertext: nil, otp_enabled_at: nil, otp_last_step: nil, otp_recovery_digests: [],
            otp_failed_attempts: 0, otp_locked_until: nil)
  end

  private

  def two_factor_secret = TwoFactorAuth.encryptor.decrypt_and_verify(otp_secret_ciphertext)

  def totp = ROTP::TOTP.new(two_factor_secret, issuer: TwoFactorAuth::ISSUER)

  # The time of the step a code belongs to, or nil. A step that was already used does not match again.
  def match_totp(code)
    text = code.to_s.delete(" ")
    return unless text.match?(/\A\d{6}\z/)

    totp.verify(text, drift_ahead: DRIFT, drift_behind: DRIFT, after: otp_last_step)
  end

  def consume_second_factor(text)
    if (step = match_totp(text))
      update!(otp_last_step: step)
      return :code
    end

    digest = TwoFactorAuth.digest(text)
    match = otp_recovery_digests.find { |stored| ActiveSupport::SecurityUtils.secure_compare(stored, digest) }
    return false unless match

    update!(otp_recovery_digests: otp_recovery_digests - [match])
    :recovery_code
  end
end
