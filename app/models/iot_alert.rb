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

  # An alert moves open → acknowledged → resolved; it can also be suppressed (silenced without being fixed).
  class InvalidTransition < StandardError; end

  OPERATOR_WORDS = {
    "gt" => "above", "lt" => "below", "gte" => "at or above", "lte" => "at or below",
    "eq" => "equal to", "outside_range" => "outside"
  }.freeze

  # ─── Scopes ────────────────────────────────────────────────────────────────

  scope :open_alerts,    -> { where(status: :open) }
  scope :for_asset,      ->(asset_id)   { where(asset_id: asset_id) }
  scope :for_rule,       ->(rule_id)    { where(iot_rule_id: rule_id) }
  scope :recent,         ->             { order(created_at: :desc) }
  scope :since,          ->(time)       { where("iot_alerts.created_at >= ?", time) }
  scope :until_time,     ->(time)       { where("iot_alerts.created_at <= ?", time) }

  # How serious the alert is: the priority of the rule that raised it (critical, high, medium or low).
  def severity = iot_rule.wo_priority

  # One line for lists and toasts, for example "temperature above 85 °C (reading 91.2 °C)".
  def message
    unit = iot_rule.unit.presence
    limit = operator == "outside_range" ? "#{number(threshold)} to #{number(iot_rule.threshold_max)}" : number(threshold)
    "#{metric_name} #{OPERATOR_WORDS.fetch(operator, operator)} #{[limit, unit].compact.join(' ')} " \
      "(reading #{[number(triggered_value), unit].compact.join(' ')})"
  end

  # How long it was (or has been) a problem, in minutes.
  def duration_minutes = (((resolved_at || Time.current) - created_at) / 60).round

  # Someone has seen it. Only an open alert can be acknowledged.
  def acknowledge!(by:, notes: nil)
    ensure_in!(%w[open], "acknowledged")
    transaction do
      update!(status: :acknowledged, acknowledged_by: by, acknowledged_at: Time.current, notes: notes.presence || self.notes)
      iot_rule.increment!(:times_acknowledged) # rubocop:disable Rails/SkipsModelValidations -- a counter
    end
  end

  # It is dealt with. An alert that is not already resolved can be.
  def resolve!(notes: nil)
    ensure_in!(%w[open acknowledged suppressed], "resolved")
    update!(status: :resolved, resolved_at: Time.current, notes: notes.presence || self.notes)
  end

  # Silenced without being fixed. Only an alert still needing attention can be.
  def suppress!
    ensure_in!(%w[open acknowledged], "suppressed")
    update!(status: :suppressed)
  end

  private

  def ensure_in!(allowed, to)
    return if allowed.include?(status)

    raise InvalidTransition, status == to ? "This alert is already #{status}" : "This alert is #{status}, so it cannot be #{to}"
  end

  # 85.0 shows as 85 and 91.25 as 91.25.
  def number(value) = value.to_d.to_s("F").sub(/\.0\z/, "")
end
