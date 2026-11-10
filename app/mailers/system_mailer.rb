class SystemMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  # Sent from Settings to check that the mail server works.
  def test_email(recipient, from:)
    @recipient = recipient
    in_language_of(recipient) { mail(to: recipient.email, from: from, subject: t(".subject")) }
  end
end
