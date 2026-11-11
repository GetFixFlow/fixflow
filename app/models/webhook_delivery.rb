# One message to one webhook: what was sent, and what happened to it (each attempt, until it got through or gave up).
class WebhookDelivery < ApplicationRecord
  STATUSES = %w[pending delivered failed].freeze
  # How long to wait after attempt 1, 2, 3...: a receiver that is restarting or briefly down gets about nine hours.
  RETRY_AFTER = [1.minute, 5.minutes, 30.minutes, 2.hours, 6.hours].freeze
  MAX_ATTEMPTS = RETRY_AFTER.size + 1
  KEEP_FOR = 30.days

  acts_as_tenant :organization
  belongs_to :organization
  belongs_to :webhook

  validates :event, :event_id, presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :recent, -> { order(created_at: :desc, id: :desc) }
  scope :old, -> { where(created_at: ...KEEP_FOR.ago) }

  def delivered? = status == "delivered"

  def body = payload.to_json

  # The word for the wait before the next attempt, or nil when there is none.
  def retry_delay = RETRY_AFTER[attempts - 1]
end
