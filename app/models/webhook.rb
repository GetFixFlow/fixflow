# An address the company's other systems listen on, and which events are sent to it. Each message is signed with the
# webhook's secret (see WebhookSender) so the receiver can tell it came from here.
class Webhook < ApplicationRecord
  MAX_PER_COMPANY = 20
  # After this many deliveries in a row that gave up, the webhook is switched off (an address that no longer answers).
  DISABLE_AFTER = 10

  include Auditable

  acts_as_tenant :organization
  belongs_to :organization
  belongs_to :created_by, class_name: "User", optional: true
  has_many :deliveries, class_name: "WebhookDelivery", dependent: :delete_all

  audited ignore: %w[secret_ciphertext consecutive_failures last_delivery_at]

  validates :name, presence: true, length: { maximum: 100 }
  validates :url, presence: true
  validate :url_is_usable, if: -> { url.present? && (new_record? || will_save_change_to_url?) }
  validate :events_are_known
  validate :not_too_many, on: :create

  before_create { self.secret_ciphertext ||= WebhookSecret.encrypt(WebhookSecret.generate) }

  scope :listening_to, ->(event) { where(active: true, disabled_at: nil).where("? = ANY (events)", event) }

  def secret = WebhookSecret.decrypt(secret_ciphertext)

  # A new secret; the old one stops being used at once. Returns it: it is shown once.
  def rotate_secret!
    new_secret = WebhookSecret.generate
    update!(secret_ciphertext: WebhookSecret.encrypt(new_secret))
    new_secret
  end

  def enabled? = active && disabled_at.nil?

  def disable!(reason)
    update!(disabled_at: Time.current, disabled_reason: reason)
  end

  # Switching it on again clears what switched it off.
  def enable!
    update!(active: true, disabled_at: nil, disabled_reason: nil, consecutive_failures: 0)
  end

  private

  def audit_update_verb
    return unless saved_change_to_disabled_at?

    disabled_at.present? ? "disabled" : "enabled"
  end

  def url_is_usable
    problem = WebhookAddress.problem(url)
    errors.add(:url, problem) if problem
  end

  def events_are_known
    unknown = Array(events) - Webhooks::EVENTS.keys
    errors.add(:events, "are not known: #{unknown.join(', ')}") if unknown.any?
    errors.add(:events, "need at least one") if Array(events).empty?
  end

  def not_too_many
    return unless organization && organization.webhooks.count >= MAX_PER_COMPANY
    errors.add(:base,
"A company can have #{MAX_PER_COMPANY} webhooks at most")
  end
end
