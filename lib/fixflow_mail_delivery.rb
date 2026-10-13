# How every email leaves the app in production: through the mail server the administrator saved in
# Settings, or, when none is saved, the one in the server's environment (SMTP_HOST and the rest).
# Looked up for each email, so changing the settings applies at once without a restart.
class FixflowMailDelivery
  def initialize(_settings = {}); end

  def deliver!(mail)
    saved = EmailSetup.saved_config
    if saved
      mail.from = saved.from
      Mail::SMTP.new(saved.to_mail_settings).deliver!(mail)
    else
      Mail::SMTP.new(self.class.environment_settings).deliver!(mail)
    end
  end

  def self.environment_settings
    {
      address:              ENV.fetch("SMTP_HOST", "smtp.sendgrid.net"),
      port:                 ENV.fetch("SMTP_PORT", 587).to_i,
      user_name:            ENV.fetch("SMTP_USERNAME", nil),
      password:             ENV.fetch("SMTP_PASSWORD", nil),
      authentication:       :plain,
      enable_starttls_auto: true
    }
  end
end
