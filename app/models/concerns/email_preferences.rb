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
    wo_needs_verification wo_new_request pm_overdue part_low_stock po_requested warranty_expiring
  ].freeze

  # Of those, the ones that are time-sensitive enough to push to a phone. The daily summaries are not.
  PUSH_EVENTS = %w[wo_assigned wo_verified pm_generated wo_needs_verification wo_new_request part_low_stock po_requested].freeze

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

  # Whether to push this to the person's browsers: they chose push for it, and at least one browser is subscribed.
  def wants_push?(event)
    raise ArgumentError, "unknown push event #{event.inspect}" unless PUSH_EVENTS.include?(event.to_s)

    prefs = email_preferences
    active? && prefs["push_enabled"] && prefs.dig("rules", event.to_s, "push") && push_subscriptions.exists?
  end

  # Pushes it, if the person wants it. Never raises: a notification must not break the thing that caused it.
  def push!(event, title:, body:, path: "/")
    return unless wants_push?(event)

    PushNotificationJob.perform_later(id, title: title, body: body, url: path, tag: event.to_s)
  rescue StandardError => e
    Rails.logger.error "[Push] Could not queue #{event} for user #{id}: #{e.class} — #{e.message}"
  end

  # Everything the screen shows: the master switch, and one rule per email.
  def email_preferences
    stored = notification_preferences.is_a?(Hash) ? notification_preferences : {}
    rules  = stored["rules"].is_a?(Hash) ? stored["rules"] : {}
    {
      "email_enabled" => stored["email_enabled"] != false,
      "push_enabled" => stored["push_enabled"] != false,
      "rules" => EMAIL_EVENTS.index_with do |event|
        rule = rules[event].is_a?(Hash) ? rules[event] : {}
        { "email" => rule["email"] != false }.merge(PUSH_EVENTS.include?(event) ? { "push" => rule["push"] != false } : {})
      end
    }
  end

  # Changes only what is given. Anything but true or false is refused, and an email this app
  # does not send is ignored.
  def update_email_preferences!(changes)
    changes = changes.to_h.stringify_keys
    merged = email_preferences

    merged["email_enabled"] = switch_value!(changes["email_enabled"]) if changes.key?("email_enabled")
    merged["push_enabled"] = switch_value!(changes["push_enabled"]) if changes.key?("push_enabled")
    changes["rules"].to_h.each do |event, rule|
      next unless EMAIL_EVENTS.include?(event.to_s)

      change_rule!(merged["rules"][event.to_s], rule)
    end

    update!(notification_preferences: merged)
  end

  private

  # A rule is {email:, push:}; a bare true or false is the email switch (what the screen sent before push existed).
  def change_rule!(rule, change)
    change = { "email" => change } unless change.is_a?(Hash)
    change = change.to_h.stringify_keys
    rule["email"] = switch_value!(change["email"]) if change.key?("email")
    rule["push"] = switch_value!(change["push"]) if change.key?("push") && rule.key?("push")
  end

  def switch_value!(value)
    return value if [true, false].include?(value)

    errors.add(:notification_preferences, "can only be switched on or off")
    raise ActiveRecord::RecordInvalid, self
  end
end
