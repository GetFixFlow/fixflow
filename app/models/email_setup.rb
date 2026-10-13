# Whether this install can send email, and where the web app lives (for links in emails).
#
# The mail server comes from the first of: what the administrator saved in the app
# (Settings, Email), or SMTP_HOST and SMTP_PASSWORD in the server's environment.
module EmailSetup
  def self.base_url
    ENV["APP_URL"].presence ||
      (Rails.env.production? ? "https://#{ENV.fetch('APP_HOST', 'localhost')}" : "http://localhost:3001")
  end

  # The mail server saved in the app, if there is one that is complete.
  def self.saved_config
    config = Organization.the_company&.smtp_config
    config if config&.configured?
  rescue ActiveRecord::ActiveRecordError
    nil # the database is not ready (for example while it is being set up)
  end

  def self.env_configured? = ENV["SMTP_HOST"].present? && ENV["SMTP_PASSWORD"].present?

  # :settings, :environment, or nil when nothing is set up.
  def self.source
    return :settings if saved_config
    :environment if env_configured?
  end

  # In production the mail server must be set up. Elsewhere mail is captured or logged.
  def self.configured?
    return true unless Rails.env.production?

    source.present?
  end
end
