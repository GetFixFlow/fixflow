class User < ApplicationRecord
  include Devise::JWT::RevocationStrategies::JTIMatcher

  ROLES = %w[admin manager technician requester].freeze

  devise :database_authenticatable, :registerable, :recoverable,
    :rememberable, :trackable, :validatable,
    :jwt_authenticatable, jwt_revocation_strategy: self

  INVITATION_TTL = 7.days

  include PasswordReset
  include EmailPreferences

  belongs_to :organization
  belongs_to :invited_by, class_name: "User", optional: true
  has_many :assigned_work_orders,  class_name: "WorkOrder", foreign_key: :assignee_id,   dependent: :nullify
  has_many :requested_work_orders, class_name: "WorkOrder", foreign_key: :requester_id, dependent: :nullify
  has_many :verified_work_orders,  class_name: "WorkOrder", foreign_key: :verified_by_id, dependent: :nullify
  has_many :comments, dependent: :destroy

  validates :role, inclusion: { in: ROLES }
  validates :first_name, :last_name, presence: true
  validates :hourly_rate, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100_000 }, allow_nil: true

  scope :by_role, ->(role) { where(role: role) }
  scope :active, -> { where(deactivated_at: nil) }
  scope :technicians, -> { where(role: "technician") }
  scope :managers, -> { where(role: %w[admin manager]) }

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
end
