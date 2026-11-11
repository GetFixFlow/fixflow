class InvitationMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")

  def invite(user, invitation_url, personal_message = nil)
    @user            = user
    @invitation_url  = invitation_url
    @personal_message = personal_message.presence
    @inviter         = user.invited_by
    @organization    = user.organization
    in_language_of(user) do
      mail(to: user.email, subject: t(".subject", organization: @organization.name))
    end
  end
end
