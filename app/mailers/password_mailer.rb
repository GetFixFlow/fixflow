class PasswordMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def reset(user, reset_url)
    @user      = user
    @reset_url = reset_url
    in_language_of(user) { mail(to: user.email, subject: t(".subject")) }
  end
end
