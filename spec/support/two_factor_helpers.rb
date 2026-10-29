# Two-factor sign-in in specs: switch it on for a user without going through the screens, and make the code the
# person's authenticator app would show.
module TwoFactorHelpers
  # Returns the recovery codes. The code that switched it on is forgotten again, because a code works once and the
  # spec is about to use the same minute's code to sign in.
  def enable_two_factor_for(user)
    user.start_two_factor_setup!
    codes = user.enable_two_factor!(code_for(user))
    user.update!(otp_last_step: nil)
    codes
  end

  def code_for(user, at: Time.current)
    ROTP::TOTP.new(user.reload.send(:two_factor_secret)).at(at)
  end
end

RSpec.configure { |config| config.include TwoFactorHelpers }
