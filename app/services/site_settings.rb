# What a site's calendar is: the time zone, work hours, work days and holidays that are the site's own, over the company's.
# Kept on the site (Location#settings); a key the site does not set follows the company. Used where the schedule is laid out and
# where a person's dates are read (see SiteAccess.time_zone).
class SiteSettings
  include ActiveModel::Validations

  KEYS = %w[timezone work_hours work_days holidays].freeze

  attr_reader :values

  validate :settings_are_valid

  # The settings in force at a site: the company's, with whatever the site sets of its own on top. With no site, the company's.
  def self.for(site)
    company = site ? Organization.unscoped.find_by(id: site.organization_id) : nil
    (company ? company.settings_with_defaults.slice(*KEYS) : {}).merge((site&.settings || {}).slice(*KEYS))
  end

  # What a site sets of its own, cleaned from form or JSON input (a blank value means "follow the company").
  def self.clean(input)
    input = input.to_h.stringify_keys.slice(*KEYS)
    input.each_with_object({}) do |(key, value), own|
      next if value.blank? && value != 0

      own[key] = case key
                 when "work_days" then Array(value).map { |day| Integer(day, exception: false) || day }.uniq.sort_by(&:to_s)
                 when "holidays" then Array(value).map { |holiday| holiday.to_h.stringify_keys.slice("date", "name", "repeating") }
                 when "work_hours" then value.to_h.stringify_keys.slice("start", "end")
                 else value.to_s.strip
                 end
    end
  end

  def initialize(own)
    @values = own || {}
  end

  private

  def settings_are_valid
    errors.add(:timezone, "is not a valid time zone") if values.key?("timezone") && !ActiveSupport::TimeZone[values["timezone"].to_s]
    validate_work_hours(values["work_hours"]) if values.key?("work_hours")
    if values.key?("work_days") && !(values["work_days"].is_a?(Array) && values["work_days"].all? { |d|
      d.is_a?(Integer) && (0..6).cover?(d)
    })
      errors.add(:work_days, "must be days numbered 0 (Sunday) to 6 (Saturday)")
    end
    return unless values.key?("holidays")
    return if values["holidays"].is_a?(Array) && values["holidays"].all? { |h|
      h["date"].to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/) && h["name"].present?
    }

    errors.add(:holidays, "each need a date (YYYY-MM-DD) and a name")
  end

  def validate_work_hours(hours)
    times = hours.is_a?(Hash) ? [hours["start"], hours["end"]] : []
    return errors.add(:work_hours, "need start and end times as HH:MM") unless times.size == 2 && times.all? { |t|
      t.to_s.match?(/\A([01]\d|2[0-3]):[0-5]\d\z/)
    }

    errors.add(:work_hours, "must end after they start") unless times[0] < times[1]
  end
end
