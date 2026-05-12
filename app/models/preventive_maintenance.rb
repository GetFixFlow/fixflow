class PreventiveMaintenance < ApplicationRecord
  FREQUENCY_TYPES = %w[calendar meter_reading condition_trigger].freeze
  FREQUENCY_UNITS = %w[days weeks months hours cycles].freeze

  belongs_to :organization
  belongs_to :asset

  validates :name, presence: true
  validates :frequency_type, inclusion: { in: FREQUENCY_TYPES }
  validates :frequency_unit, inclusion: { in: FREQUENCY_UNITS }
  validates :frequency_value, numericality: { greater_than: 0 }

  scope :active, -> { where(active: true) }
  scope :due, -> { active.where("next_due_at <= ?", Time.current) }
  scope :overdue, -> { active.where("next_due_at < ?", Time.current) }

  def calculate_next_due
    base = last_run_at || created_at
    case frequency_unit
    when "days"   then base + frequency_value.days
    when "weeks"  then base + frequency_value.weeks
    when "months" then base + frequency_value.months
    when "hours"  then base + frequency_value.hours
    else base + frequency_value.days
    end
  end
end
