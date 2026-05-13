class ApiKey < ApplicationRecord
  KEY_PREFIX = "fxk_".freeze

  # ─── Associations ──────────────────────────────────────────────────────────

  acts_as_tenant :organization
  belongs_to :organization

  # ─── Validations ───────────────────────────────────────────────────────────

  validates :name,       presence: true
  validates :key_digest, presence: true

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :active_keys, -> { where(active: true) }
  scope :for_org,     ->(org_id) { where(organization_id: org_id) }

  # ─── Key generation ────────────────────────────────────────────────────────

  def self.generate
    raw_key = "#{KEY_PREFIX}#{SecureRandom.hex(32)}"
    digest  = BCrypt::Password.create(raw_key)
    [raw_key, digest]
  end

  def self.authenticate(raw_key)
    # Narrow candidates by prefix to avoid full-table bcrypt comparison
    candidates = active_keys.where("key_digest IS NOT NULL")
    candidates.find do |api_key|
      next if api_key.expired?
      BCrypt::Password.new(api_key.key_digest) == raw_key
    end
  end

  def expired?
    expires_at.present? && expires_at < Time.current
  end

  def touch_last_used
    update_column(:last_used_at, Time.current)
  end
end
