# Password reset links. Devise generates and checks the token; the link points at the
# web app, not at an API route.
module PasswordReset
  extend ActiveSupport::Concern

  # People who can use a reset link: active, and past the invitation step (someone who
  # was invited has not chosen a password yet and uses their invitation link instead), and not signed in through the
  # directory (whose password is not kept here).
  def can_reset_password?
    active? && !invitation_pending? && !directory_managed?
  end

  # Returns the link to send or hand over. Any earlier link stops working.
  def reset_password_url
    raw_token = send(:set_reset_password_token)
    "#{EmailSetup.base_url}/reset-password?token=#{raw_token}"
  end
end
