# A running-hours counter, odometer or cycle count on an asset. Its reading is entered by hand or fed by a sensor, and
# a preventive maintenance schedule can fall due when the reading passes a limit (see PmMeterService).
class Meter < ApplicationRecord
  include Auditable

  acts_as_tenant :organization
  # The reading moves all the time and every reading is kept in meter_readings; only a person's edits are worth a line.
  audited ignore: %w[reading last_reading_at]

  belongs_to :organization
  belongs_to :asset
  has_many :readings, class_name: "MeterReading", dependent: :delete_all
  has_many :preventive_maintenances, dependent: :restrict_with_error

  normalizes :name, :unit, with: ->(text) { text.to_s.strip }
  normalizes :sensor_metric, with: ->(text) { text.to_s.strip.presence }

  validates :name, presence: true, length: { maximum: 80 }, uniqueness: { scope: :asset_id, case_sensitive: false }
  validates :unit, presence: true, length: { maximum: 20 }
  validates :sensor_metric, length: { maximum: 80 }, uniqueness: { scope: :asset_id }, allow_nil: true
  validates :reading, numericality: { greater_than_or_equal_to: 0, less_than: 10**12 }
  validate :asset_belongs_to_same_org

  scope :for_sensor, ->(asset_id, metric) { where(asset_id: asset_id, sensor_metric: metric) }

  private

  def asset_belongs_to_same_org
    errors.add(:asset, "must belong to the same organization") if asset && asset.organization_id != organization_id
  end
end
