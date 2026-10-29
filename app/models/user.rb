class User < ApplicationRecord
  include Devise::JWT::RevocationStrategies::JTIMatcher

  ROLES = %w[admin manager technician requester].freeze

  devise :database_authenticatable, :registerable, :recoverable,
    :rememberable, :trackable, :validatable, :lockable,
    :jwt_authenticatable, jwt_revocation_strategy: self

  INVITATION_TTL = 7.days

  include PasswordReset
  include TwoFactorAuth
  include PasswordPolicy
  include Auditable

  # A whitelist: sign-in counters, tokens and preferences change all the time and are not edits. The password is
  # logged as "password" (that it changed, never what it is), pay by its name only.
  audited watch: %w[first_name last_name email role phone job_title department hourly_rate encrypted_password],
          values: %w[role]
  include EmailPreferences

  belongs_to :organization
  belongs_to :invited_by, class_name: "User", optional: true
  has_many :assigned_work_orders,  class_name: "WorkOrder", foreign_key: :assignee_id,   dependent: :nullify
  has_many :requested_work_orders, class_name: "WorkOrder", foreign_key: :requester_id, dependent: :nullify
  has_many :verified_work_orders,  class_name: "WorkOrder", foreign_key: :verified_by_id, dependent: :nullify
  has_many :comments, dependent: :destroy
  has_many :user_sessions, dependent: :delete_all

  # ── Sessions ────────────────────────────────────────────────────────────
  #
  # Each sign-in gets its own id (sid) inside the token and a row in user_sessions, so a person can
  # see where they are signed in and end one. A token works while the user's jti still matches (a
  # password change or deactivation replaces it, ending every session) and its own session is live.

  def jwt_payload = super.merge("sid" => SecureRandom.uuid)

  # Called when a token is made at sign-in or sign-up.
  def on_jwt_dispatch(_token, payload)
    user_sessions.where(expires_at: ...1.day.ago).delete_all
    session = user_sessions.create!(
      sid: payload["sid"], jti: payload["jti"], expires_at: Time.zone.at(payload["exp"]),
      user_agent: UserSession.clean_agent(Current.user_agent), ip_address: Current.request_ip,
      last_active_at: Time.current
    )
    ActivityLogService.log(action: "user.signed_in", resource: self, user: self, metadata: { device: session.device })
  end

  # The session a token belongs to, when the token is still good; nil otherwise.
  def self.live_session_for(payload, user)
    return unless payload["jti"] == user.jti && payload["sid"].present?

    session = user.user_sessions.live.find_by(sid: payload["sid"], jti: payload["jti"])
    session&.tap { |s| s.update_column(:last_active_at, Time.current) if s.last_active_at < UserSession::TOUCH_EVERY.ago } # rubocop:disable Rails/SkipsModelValidations
  end

  def self.jwt_revoked?(payload, user) = live_session_for(payload, user).nil?

  # Signing out ends this session only; the person's other sessions carry on.
  def self.revoke_jwt(payload, user)
    user.user_sessions.where(sid: payload["sid"], revoked_at: nil).find_each(&:revoke!)
  end

  validates :role, inclusion: { in: ROLES }
  validates :first_name, :last_name, presence: true
  validates :hourly_rate, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100_000 }, allow_nil: true

  scope :by_role, ->(role) { where(role: role) }
  scope :active, -> { where(deactivated_at: nil) }
  scope :technicians, -> { where(role: "technician") }
  scope :managers, -> { where(role: %w[admin manager]) }

  # What the audit log calls this person.
  def audit_name = full_name.presence || email

  def full_name
    "#{first_name} #{last_name}".strip
  end

  # The profile form edits one name field. The first word is the first name and the
  # rest is the last name; a single word leaves the last name blank, which fails validation.
  def full_name=(value)
    first, last = value.to_s.strip.split(/\s+/, 2)
    self.first_name = first
    self.last_name = last
  end

  # Deactivated people cannot sign in, and every token they hold stops working.
  def active?
    deactivated_at.nil?
  end

  def active_for_authentication?
    super && active?
  end

  # Called by Devise when the wrong passwords reach the limit.
  def lock_access!(opts = {})
    super
    ActivityLogService.log(action: "user.locked", resource: self, user: self)
  end

  def inactive_message
    active? ? super : :deactivated
  end

  # admin?, manager?, technician? and requester? check the user's own role only.
  # The policies layer the hierarchy on top (see ApplicationPolicy).
  ROLES.each do |name|
    define_method(:"#{name}?") { role == name }
  end

  # ── Invitations ──────────────────────────────────────────────────────────
  # Only a digest of the token is stored, so a raw link is shown once. Sending a
  # new invitation replaces the old link.

  def self.find_by_invitation_token(raw_token)
    return nil if raw_token.blank?
    find_by(invitation_token_digest: invitation_digest(raw_token))
  end

  def self.invitation_digest(raw_token)
    Digest::SHA256.hexdigest(raw_token.to_s)
  end

  # Returns the raw token to put in the invitation link.
  def invite!(invited_by:)
    raw_token = SecureRandom.urlsafe_base64(32)
    update!(
      invitation_token_digest: self.class.invitation_digest(raw_token),
      invitation_sent_at:      Time.current,
      invitation_accepted_at:  nil,
      invited_by:              invited_by
    )
    raw_token
  end

  def invitation_pending?
    invitation_token_digest.present? && invitation_accepted_at.nil?
  end

  def invitation_expired?
    invitation_sent_at.blank? || invitation_sent_at < INVITATION_TTL.ago
  end

  def accept_invitation!(password:, password_confirmation:)
    update!(
      password:                password,
      password_confirmation:   password_confirmation,
      invitation_token_digest: nil,
      invitation_accepted_at:  Time.current
    )
  end

  def manager_or_above?
    role.in?(%w[admin manager])
  end

  private

  # Deactivating and reactivating a person are events of their own in the log.
  def audit_update_verb
    return unless saved_change_to_deactivated_at?

    deactivated_at.present? ? "deactivated" : "reactivated"
  end
end
