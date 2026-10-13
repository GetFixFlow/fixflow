# Whether this install can send email, and where the web app lives (for links in emails).
module EmailSetup
  def self.base_url
    ENV["APP_URL"].presence ||
      (Rails.env.production? ? "https://#{ENV.fetch('APP_HOST', 'localhost')}" : "http://localhost:3001")
  end

  # In production the mail server must be set up. Elsewhere mail is captured or logged.
  def self.configured?
    return true unless Rails.env.production?

    ENV["SMTP_HOST"].present? && ENV["SMTP_PASSWORD"].present?
  end
end
