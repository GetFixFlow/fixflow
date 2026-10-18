class BackupMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  # To each administrator when the nightly backup has failed on every try. Not a choice on the notification
  # screen: like an invitation or a password reset, it is sent whatever the person chose.
  def failed(admin, reason, failed_at)
    @admin     = admin
    @reason    = reason
    @failed_at = failed_at
    @url       = "#{EmailSetup.base_url}/settings/data-retention"
    mail(to: admin.email, subject: "[FixFlow] The nightly backup failed") # rubocop:disable Rails/I18nLocaleTexts
  end
end
