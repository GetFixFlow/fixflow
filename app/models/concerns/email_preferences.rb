# Which emails a person wants. Every email the app sends about work (not the ones a person
# must get, like an invitation or a password reset link) is checked against this first.
#
# Stored in users.notification_preferences, merged over "everything on", so a person who
# never opened the screen gets every email, as before.
module EmailPreferences
  extend ActiveSupport::Concern

  # The emails that exist today, by who gets them:
  EMAIL_EVENTS = %w[
    wo_assigned wo_verified pm_generated pm_due_soon
    wo_needs_verification wo_new_request pm_overdue part_low_stock
  ].freeze

  class_methods do
    # Of the people in the current scope (a company's managers, say), those who want this email.
    def wanting_email(event) = all.select { |user| user.wants_email?(event) }
  end

  # Deactivated people get nothing, whatever they chose.
  def wants_email?(event)
    raise ArgumentError, "unknown email event #{event.inspect}" unless EMAIL_EVENTS.include?(event.to_s)

    prefs = email_preferences
    active? && prefs["email_enabled"] && prefs.dig("rules", event.to_s, "email")
  end

  # Everything the screen shows: the master switch, and one rule per email.
  def email_preferences
    stored = notification_preferences.is_a?(Hash) ? notification_preferences : {}
    rules  = stored["rules"].is_a?(Hash) ? stored["rules"] : {}
    {
      "email_enabled" => stored["email_enabled"] != false,
      "rules" => EMAIL_EVENTS.index_with do |event|
        rule = rules[event].is_a?(Hash) ? rules[event] : {}
        { "email" => rule["email"] != false }
      end
    }
  end

  # Changes only what is given. Anything but true or false is refused, and an email this app
  # does not send is ignored.
  def update_email_preferences!(changes)
    changes = changes.to_h.stringify_keys
    merged = email_preferences

    merged["email_enabled"] = switch_value!(changes["email_enabled"]) if changes.key?("email_enabled")
    changes["rules"].to_h.each do |event, rule|
      next unless EMAIL_EVENTS.include?(event.to_s)

      merged["rules"][event.to_s]["email"] = switch_value!(rule.is_a?(Hash) ? rule["email"] : rule)
    end

    update!(notification_preferences: merged)
  end

  private

  def switch_value!(value)
    return value if [true, false].include?(value)

    errors.add(:notification_preferences, "can only be switched on or off")
    raise ActiveRecord::RecordInvalid, self
  end
end
