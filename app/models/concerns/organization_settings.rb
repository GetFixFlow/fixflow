# The company settings screen. The name is a column; everything else lives in the
# settings jsonb column, merged over these defaults.
#
# Applied today: timezone, wo_number_prefix, default_priority, default_due_days, the regional display settings
# (date_format, time_format, currency, number_format, first_day_of_week), and work_hours, work_days and holidays (the
# hours a day holds on the schedule, see TeamSchedule) and approval_limit (see WorkOrderApproval).
# The rest are stored and returned but nothing reads them yet.
module OrganizationSettings
  extend ActiveSupport::Concern

  PRIORITIES = %w[low medium high critical].freeze
  AUTO_WO_THRESHOLDS = %w[critical high medium never].freeze
  DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "DD MMM YYYY", "MMM D, YYYY"].freeze
  TIME_FORMATS = %w[12h 24h].freeze
  CURRENCIES = %w[USD EUR GBP JPY CAD AUD CHF INR LKR SGD].freeze
  NUMBER_FORMATS = ["1,234.56", "1.234,56", "1 234.56", "1 234,56"].freeze
  DAYS_OF_WEEK = %w[monday sunday].freeze
  # The settings shown on the Localization screen.
  LOCALIZATION_KEYS = %w[timezone date_format time_format currency number_format first_day_of_week].freeze

  DEFAULTS = {
    "industry" => "", "size" => "", "website" => "", "address" => "",
    "timezone" => "UTC",
    "date_format" => "MMM D, YYYY",
    "time_format" => "12h",
    "currency" => "USD",
    "number_format" => "1,234.56",
    "first_day_of_week" => "sunday", # what the calendars and reports always used
    "wo_number_prefix" => "WO",
    "default_priority" => "medium",
    "default_due_days" => 7,
    "labor_rate" => 0,
    "approval_limit" => 0, # 0: no approvals
    "require_completion_notes" => false,
    "auto_close_days" => 30,
    "pm_compliance_target" => 90,
    "pm_reminder_days" => 7,
    "pm_pause_on_down" => false,
    "iot_alert_cooldown" => 60,
    "iot_stale_threshold" => 300,
    "iot_data_retention_days" => 365,
    "audit_log_retention_days" => 0, # 0: keep the audit log for ever
    "update_check" => true,
    "public_requests_enabled" => true,
    "require_two_factor" => false,
    "iot_auto_wo_threshold" => "critical",
    "work_hours" => { "start" => "08:00", "end" => "17:00" },
    "work_days" => [1, 2, 3, 4, 5],
    "holidays" => []
  }.freeze

  INTEGER_KEYS = %w[default_due_days auto_close_days pm_compliance_target pm_reminder_days
                    iot_alert_cooldown iot_stale_threshold iot_data_retention_days audit_log_retention_days].freeze
  DECIMAL_KEYS = %w[labor_rate approval_limit].freeze
  BOOLEAN_KEYS = %w[require_completion_notes pm_pause_on_down update_check public_requests_enabled require_two_factor].freeze
  KEYS = DEFAULTS.keys.freeze

  include Validation

  # Stored values over the defaults.
  def settings_with_defaults
    DEFAULTS.merge(environment_defaults).deep_merge((settings || {}).slice(*KEYS))
  end

  def default_priority = settings_with_defaults["default_priority"]

  # Whether everyone in the company must sign in with an authenticator app.
  def require_two_factor? = settings_with_defaults["require_two_factor"] == true

  # What an hour of work costs when the person doing it has no rate of their own.
  def default_labor_rate = BigDecimal(settings_with_defaults["labor_rate"].to_s)
  # What a work order may cost before a manager has to approve it; 0 when nothing needs approving.
  def approval_limit = BigDecimal(settings_with_defaults["approval_limit"].to_s)
  def default_due_days = settings_with_defaults["default_due_days"].to_i

  def timezone_or_default
    zone = settings_with_defaults["timezone"].to_s
    ActiveSupport::TimeZone[zone] ? zone : "UTC"
  end

  # How many days of sensor readings (and their hourly summaries) are kept: what the company chose, else the
  # IOT_RETENTION_DAYS the server was started with (how this was set before it was a company setting), else a year.
  # The settings screens show this same number (see settings_with_defaults), so what is shown is what is applied.
  def sensor_retention_days = settings_with_defaults["iot_data_retention_days"].to_i

  # How many days of audit log are kept; nil when it is kept for ever.
  def audit_log_retention_days
    days = settings_with_defaults["audit_log_retention_days"].to_i
    days.positive? ? days : nil
  end

  def prefix_for_work_orders = settings_with_defaults["wo_number_prefix"].presence || "WO"

  # Settings whose default can be set in the server's environment. A value that is not a whole number in the allowed
  # range is ignored, not applied (a typo must not decide how much data is deleted).
  def environment_defaults
    days = ENV["IOT_RETENTION_DAYS"].to_s
    days.match?(/\A\d+\z/) && days.to_i.between?(1, 3650) ? { "iot_data_retention_days" => days.to_i } : {}
  end

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
    elsif DECIMAL_KEYS.include?(key)
      # Kept as given when it is not a number, so validation says so instead of it being turned into zero.
      Float(value, exception: false) || value
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
