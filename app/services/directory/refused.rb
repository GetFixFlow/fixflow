module Directory
  # A person the directory knows but who may not sign in; `code` is what the sign-in screen has words for. The message
  # is for the log and the administrator (it names the person); `user_message` is what the person is told.
  class Refused < StandardError
    USER_MESSAGES = {
      not_allowed: "Your account is not in a group that may use FixFlow. Ask your administrator.",
      no_account: "You do not have an account here yet. Ask your administrator.",
      deactivated: "Your account has been deactivated. Ask your administrator.",
      email_not_verified: "An account with your email address already exists here and could not be linked. Ask your administrator.",
      account_conflict: "Your email address is already used by an account that signs in another way. Ask your administrator.",
      failed: "Signing in through your company account did not work. Try again, or ask your administrator."
    }.freeze

    attr_reader :code

    def initialize(code, message = nil)
      @code = code
      super(message || code.to_s)
    end

    def user_message = USER_MESSAGES.fetch(code.to_sym) { USER_MESSAGES[:failed] }
  end
end
