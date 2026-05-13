class IotAlert < ApplicationRecord
  # ─── Enums ─────────────────────────────────────────────────────────────────

  enum :status, { open: 0, acknowledged: 1, resolved: 2, suppressed: 3 }, default: :open

  # ─── Associations ──────────────────────────────────────────────────────────

  belongs_to :iot_rule
  belongs_to :asset
  belongs_to :sensor_reading
  belongs_to :work_order,       optional: true
  belongs_to :acknowledged_by,  class_name: "User", optional: true

  # ─── Validations ───────────────────────────────────────────────────────────

  validates :metric_name,     presence: true
  validates :triggered_value, numericality: true
  validates :threshold,       numericality: true
  validates :operator,        presence: true

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :open_alerts,    -> { where(status: :open) }
  scope :for_asset,      ->(asset_id)   { where(asset_id: asset_id) }
  scope :for_rule,       ->(rule_id)    { where(iot_rule_id: rule_id) }
  scope :recent,         ->             { order(created_at: :desc) }
  scope :since,          ->(time)       { where("created_at >= ?", time) }
  scope :until_time,     ->(time)       { where("created_at <= ?", time) }
end
