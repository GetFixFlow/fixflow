class ApiKey < ApplicationRecord
  KEY_PREFIX = "fxk_".freeze
  HINT_LENGTH = 12 # "fxk_" and the first eight characters of the secret part

  # What a key may do. A key made before scopes existed has none and may only send sensor readings, as it always could.
  #   iot    send sensor readings (POST /api/v1/iot/ingest)
  #   read   read work orders, assets, locations and parts through the public API (/api/v1/open)
  #   write  read, and create and change work orders and assets through it
  SCOPES = %w[iot read write].freeze
  # What the sensor-reading keys of earlier versions were called (the screen offered iot_write and iot_read, and all of them could
  # send readings): still accepted, and shown as iot.
  LEGACY_IOT_SCOPES = %w[iot_write iot_read iot:write].freeze

  # ─── Associations ──────────────────────────────────────────────────────────

  include Auditable

  acts_as_tenant :organization
  belongs_to :organization
  audited ignore: %w[last_used_at key_digest]

  # ─── Validations ───────────────────────────────────────────────────────────

  validates :name,       presence: true
  validates :key_digest, presence: true
  validate :scopes_are_known

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :active_keys, -> { where(active: true) }
  scope :for_org,     ->(org_id) { where(organization_id: org_id) }

  # ─── Key generation ────────────────────────────────────────────────────────

  # A new key is 256 random bits, so a fast hash is as safe as a slow one here (there is nothing to guess), and a fast one
  # lets every request of a program be checked without a second of work. Keys made before this carry a bcrypt digest, and
  # are still checked that way.
  def self.generate
    raw_key = "#{KEY_PREFIX}#{SecureRandom.hex(32)}"
    [raw_key, digest_for(raw_key)]
  end

  def self.digest_for(raw_key) = "sha256:#{Digest::SHA256.hexdigest(raw_key)}"

  def self.hint_for(raw_key) = raw_key.to_s.first(HINT_LENGTH)

  # The key this text is, when it is the secret of an active key that has not expired; nil otherwise.
  def self.authenticate(raw_key)
    raw_key = raw_key.to_s
    return unless raw_key.start_with?(KEY_PREFIX) && raw_key.length > HINT_LENGTH

    found = active_keys.where(key_hint: hint_for(raw_key)).find { |key| key.matches?(raw_key) } || find_without_hint(raw_key)
    found unless found&.expired?
  end

  # A key made before hints existed: found by trying those, once, and given its hint.
  def self.find_without_hint(raw_key)
    key = active_keys.where(key_hint: nil).find { |candidate| candidate.matches?(raw_key) }
    key&.tap { |found| found.update_columns(key_hint: hint_for(raw_key)) }
  end

  def matches?(raw_key)
    if key_digest.start_with?("sha256:")
      ActiveSupport::SecurityUtils.secure_compare(key_digest, self.class.digest_for(raw_key))
    else
      BCrypt::Password.new(key_digest) == raw_key
    end
  rescue BCrypt::Errors::InvalidHash
    false
  end

  # What the key was set up for: scopes of keys from before scopes existed come back as the one thing they could do.
  def effective_scopes
    granted = Array(scopes).map { |name| LEGACY_IOT_SCOPES.include?(name) ? "iot" : name }.uniq
    granted.presence || %w[iot]
  end

  def scope?(name)
    granted = effective_scopes
    case name.to_s
    when "read" then granted.intersect?(%w[read write])
    else granted.include?(name.to_s)
    end
  end

  def expired?
    expires_at.present? && expires_at < Time.current
  end

  def touch_last_used
    update_column(:last_used_at, Time.current)
  end

  private

  def scopes_are_known
    unknown = Array(scopes) - SCOPES - LEGACY_IOT_SCOPES
    errors.add(:scopes, "can only be #{SCOPES.join(', ')} (not #{unknown.join(', ')})") if unknown.any?
  end

  # Revoking a key is the thing to see in the log, not "updated".
  def audit_update_verb
    "revoked" if saved_change_to_active? && !active
  end
end
