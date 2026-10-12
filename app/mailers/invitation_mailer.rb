class InvitationMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def invite(user, invitation_url, personal_message = nil)
    @user            = user
    @invitation_url  = invitation_url
    @personal_message = personal_message.presence
    @inviter         = user.invited_by
    @organization    = user.organization
    mail(
      to:      user.email,
      subject: "[FixFlow] You have been invited to join #{@organization.name}"
    )
  end
end
