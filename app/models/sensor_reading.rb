class SensorReading < ApplicationRecord
  # ─── Enums ─────────────────────────────────────────────────────────────────

  enum :source,  { mqtt: 0, rest_api: 1, manual: 2 }, default: :rest_api
  enum :quality, { good: 0, uncertain: 1, bad: 2 },   default: :good

  # ─── Associations ──────────────────────────────────────────────────────────

  acts_as_tenant :organization
  belongs_to :asset
  belongs_to :organization, optional: true
  has_many   :iot_alerts

  # ─── Validations ───────────────────────────────────────────────────────────

  validates :metric_name, presence: true
  validates :value,       presence: true, numericality: true
  validates :recorded_at, presence: true

  # ─── Callbacks ─────────────────────────────────────────────────────────────

  before_create { self.received_at ||= Time.current }

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :for_metric,    ->(name)      { where(metric_name: name) }
  scope :recent,        ->            { order(recorded_at: :desc) }
  scope :since,         ->(time)      { where("recorded_at >= ?", time) }
  scope :within_range,  ->(from, to)  { where(recorded_at: from..to) }
  scope :for_device,    ->(device_id) { where(device_id: device_id) }

  # ─── Class Methods ─────────────────────────────────────────────────────────

  def self.latest_per_metric(asset_id)
    select("DISTINCT ON (metric_name) *")
      .where(asset_id: asset_id)
      .order("metric_name, recorded_at DESC")
  end

  def self.cleanup_old_readings(retention_days: ENV.fetch("IOT_RETENTION_DAYS", 90).to_i)
    cutoff = retention_days.days.ago
    where("recorded_at < ?", cutoff).delete_all
  end
end
