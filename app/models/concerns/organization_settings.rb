# The company settings screen. The name is a column; everything else lives in the
# settings jsonb column, merged over these defaults.
#
# Applied today: timezone, wo_number_prefix, default_priority, default_due_days.
# The rest are stored and returned but nothing reads them yet.
module OrganizationSettings
  extend ActiveSupport::Concern

  PRIORITIES = %w[low medium high critical].freeze
  AUTO_WO_THRESHOLDS = %w[critical high medium never].freeze

  DEFAULTS = {
    "industry" => "", "size" => "", "website" => "", "address" => "",
    "timezone" => "UTC",
    "wo_number_prefix" => "WO",
    "default_priority" => "medium",
    "default_due_days" => 7,
    "require_completion_notes" => false,
    "auto_close_days" => 30,
    "pm_compliance_target" => 90,
    "pm_reminder_days" => 7,
    "pm_pause_on_down" => false,
    "iot_alert_cooldown" => 60,
    "iot_stale_threshold" => 300,
    "iot_data_retention_days" => 365,
    "iot_auto_wo_threshold" => "critical",
    "work_hours" => { "start" => "08:00", "end" => "17:00" },
    "work_days" => [1, 2, 3, 4, 5],
    "holidays" => []
  }.freeze

  INTEGER_KEYS = %w[default_due_days auto_close_days pm_compliance_target pm_reminder_days
                    iot_alert_cooldown iot_stale_threshold iot_data_retention_days].freeze
  BOOLEAN_KEYS = %w[require_completion_notes pm_pause_on_down].freeze
  KEYS = DEFAULTS.keys.freeze

  include Validation

  # Stored values over the defaults.
  def settings_with_defaults
    DEFAULTS.deep_merge((settings || {}).slice(*KEYS))
  end

  def default_priority = settings_with_defaults["default_priority"]
  def default_due_days = settings_with_defaults["default_due_days"].to_i

  def timezone_or_default
    zone = settings_with_defaults["timezone"].to_s
    ActiveSupport::TimeZone[zone] ? zone : "UTC"
  end

  def prefix_for_work_orders = settings_with_defaults["wo_number_prefix"].presence || "WO"

  # Merge changes into the stored settings, coercing values from form or JSON input.
  def assign_company_settings(changes)
    merged = (settings || {}).dup
    changes.to_h.stringify_keys.slice(*KEYS).each do |key, value|
      merged[key] = coerce_company_setting(key, value)
    end
    self.settings = merged
  end

  private

  def coerce_company_setting(key, value)
    if INTEGER_KEYS.include?(key)
      # A fraction like 7.5 is kept as is, so validation rejects it instead of it being truncated.
      value.is_a?(Float) ? value : (Integer(value, exception: false) || value)
    elsif BOOLEAN_KEYS.include?(key)
      ActiveModel::Type::Boolean.new.cast(value)
    elsif key == "wo_number_prefix"
      value.to_s.strip.upcase
    elsif key == "work_days"
      Array(value).map { |d| Integer(d, exception: false) || d }.uniq.sort_by(&:to_s)
    elsif key == "holidays"
      Array(value).map { |h| h.to_h.stringify_keys.slice("date", "name", "repeating") }
    elsif value.is_a?(String)
      value.strip
    else
      value
    end
  end
end
