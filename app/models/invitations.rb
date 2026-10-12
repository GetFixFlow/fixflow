# Settings that decide how invitation links are built and whether email can be sent.
module Invitations
  # Where the web app lives, used to build the link in an invitation.
  def self.base_url
    ENV["APP_URL"].presence ||
      (Rails.env.production? ? "https://#{ENV.fetch('APP_HOST', 'localhost')}" : "http://localhost:3001")
  end

  # In production the mail server must be set up. Elsewhere mail is captured or logged.
  def self.email_configured?
    return true unless Rails.env.production?
    ENV["SMTP_HOST"].present? && ENV["SMTP_PASSWORD"].present?
  end
end
