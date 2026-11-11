class ApplicationMailer < ActionMailer::Base
  default from: "from@example.com"
  layout "mailer"
  helper MailFormatting
  include MailFormatting

  private

  # Writes the email in the recipient's language: the one they chose, else their company's. The block builds the subject
  # and the body (the body is rendered by `mail`, so that must be called inside it).
  def in_language_of(person, &) = Locales.with_user(person, &)

  def in_language_of_organization(organization, &) = Locales.with_organization(organization, &)
end
