# One reading of a Meter: who took it (nobody, for a sensor), when, and whether it was a reset.
class MeterReading < ApplicationRecord
  enum :source, { manual: 0, sensor: 1 }, default: :manual

  belongs_to :meter
  belongs_to :recorded_by, class_name: "User", optional: true

  validates :value, numericality: { greater_than_or_equal_to: 0, less_than: 10**12 }
  validates :recorded_at, presence: true
  validates :note, length: { maximum: 500 }

  scope :recent, -> { order(recorded_at: :desc, id: :desc) }
end
