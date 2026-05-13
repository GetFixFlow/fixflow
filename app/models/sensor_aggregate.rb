class SensorAggregate < ApplicationRecord
  # ─── Enums ─────────────────────────────────────────────────────────────────

  enum :period_type, { hourly: 0, daily: 1, weekly: 2 }, default: :hourly

  # ─── Associations ──────────────────────────────────────────────────────────

  belongs_to :asset

  # ─── Validations ───────────────────────────────────────────────────────────

  validates :metric_name,  presence: true
  validates :period_start, presence: true
  validates :period_type,  presence: true

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :for_metric,  ->(name)       { where(metric_name: name) }
  scope :for_period,  ->(type)       { where(period_type: type) }
  scope :since,       ->(time)       { where("period_start >= ?", time) }
end
