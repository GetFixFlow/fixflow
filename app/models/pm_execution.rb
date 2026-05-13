class PmExecution < ApplicationRecord
  enum :status, {
    pending:   0,
    generated: 1,
    skipped:   2,
    completed: 3
  }, prefix: true

  belongs_to :preventive_maintenance
  belongs_to :work_order, optional: true

  validates :scheduled_date, presence: true
  validates :skip_reason, presence: true, if: :status_skipped?

  scope :recent, -> { order(scheduled_date: :desc) }
  scope :for_period, ->(from, to) { where(scheduled_date: from..to) }
end
