# Validation for the company settings kept in Organization#settings.
module OrganizationSettings
  module Validation
    extend ActiveSupport::Concern

    included do
      validate :validate_company_settings
    end

    private

    def validate_company_settings
      values = settings_with_defaults
      validate_choices(values)
      validate_numbers(values)
      validate_schedule(values)
    end

    def validate_choices(values)
      errors.add(:timezone, "is not a valid time zone") unless ActiveSupport::TimeZone[values["timezone"].to_s]
      unless values["wo_number_prefix"].to_s.match?(/\A[A-Z0-9]{1,8}\z/)
        errors.add(:wo_number_prefix,
"must be 1 to 8 letters or digits")
      end
      errors.add(:default_priority, "is not a valid priority") unless PRIORITIES.include?(values["default_priority"])
      return if AUTO_WO_THRESHOLDS.include?(values["iot_auto_wo_threshold"])

      errors.add(:iot_auto_wo_threshold, "is not a valid option")
    end

    def validate_numbers(values)
      validate_integer_range(values, "default_due_days", 1..365)
      validate_integer_range(values, "auto_close_days", 0..365)
      validate_integer_range(values, "pm_compliance_target", 0..100)
      validate_integer_range(values, "pm_reminder_days", 0..30)
      validate_integer_range(values, "iot_alert_cooldown", 0..525_600)
      validate_integer_range(values, "iot_stale_threshold", 1..86_400)
      validate_integer_range(values, "iot_data_retention_days", 1..3650)
    end

    def validate_schedule(values)
      validate_work_hours(values["work_hours"])
      unless values["work_days"].is_a?(Array) && values["work_days"].all? { |d| d.is_a?(Integer) && (0..6).cover?(d) }
        errors.add(:work_days, "must be days numbered 0 (Sunday) to 6 (Saturday)")
      end
      return if values["holidays"].is_a?(Array) && values["holidays"].all? { |h| holiday_valid?(h) }

      errors.add(:holidays, "each need a date (YYYY-MM-DD) and a name")
    end

    def holiday_valid?(holiday)
      holiday["date"].to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/) && holiday["name"].present?
    end

    def validate_integer_range(values, key, range)
      value = values[key]
      return if value.is_a?(Integer) && range.cover?(value)

      errors.add(key.to_sym, "must be a whole number from #{range.min} to #{range.max}")
    end

    def validate_work_hours(hours)
      times = hours.is_a?(Hash) ? [hours["start"], hours["end"]] : []
      valid = times.size == 2 && times.all? { |t| t.to_s.match?(/\A([01]\d|2[0-3]):[0-5]\d\z/) }
      return errors.add(:work_hours, "need start and end times as HH:MM") unless valid

      errors.add(:work_hours, "must end after they start") unless times[0] < times[1]
    end
  end
end
