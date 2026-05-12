class SensorReading < ApplicationRecord
  belongs_to :asset

  validates :metric_name, presence: true
  validates :value, presence: true, numericality: true
  validates :recorded_at, presence: true

  scope :for_metric, ->(name) { where(metric_name: name) }
  scope :recent, -> { order(recorded_at: :desc) }
  scope :since, ->(time) { where("recorded_at >= ?", time) }
  scope :within_range, ->(from, to) { where(recorded_at: from..to) }

  def self.latest_per_metric(asset_id)
    select("DISTINCT ON (metric_name) *")
      .where(asset_id: asset_id)
      .order("metric_name, recorded_at DESC")
  end
end
