require "devise/orm/active_record"

Devise.setup do |config|
  config.mailer_sender = ENV.fetch("MAILER_FROM", "noreply@fixflow.dev")
  config.case_insensitive_keys = [ :email ]
  config.strip_whitespace_keys = [ :email ]
  # Authentication is by token only. Storing the signed-in user in the session cookie as
  # well would keep them signed in after the token is revoked (sign-out, password change,
  # deactivation) and would allow cookie-only requests.
  config.skip_session_storage = %i[http_auth params_auth]
  config.stretches = Rails.env.test? ? 1 : 12
  config.reconfirmable = false
  config.expire_all_remember_me_on_sign_out = true
  config.password_length = 10..128
  # Ten wrong passwords for one account lock it for 30 minutes (it opens by itself, or an administrator unlocks it).
  # This is on top of the throttle per address (Rack::Attack), which a guesser using many addresses gets past.
  config.lock_strategy = :failed_attempts
  config.unlock_strategy = :time
  config.maximum_attempts = 10
  config.unlock_in = 30.minutes
  config.last_attempt_warning = false
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/
  config.reset_password_within = 6.hours
  config.sign_out_via = :delete
  config.navigational_formats = []

  config.jwt do |jwt|
    jwt.secret = ENV.fetch("DEVISE_JWT_SECRET_KEY")
    jwt.dispatch_requests = [
      [ "POST", %r{^/api/v1/auth/sign_in$} ],
      [ "POST", %r{^/api/v1/auth/sign_up$} ],
      [ "POST", %r{^/api/v1/auth/two_factor$} ]
    ]
    jwt.revocation_requests = [
      [ "DELETE", %r{^/api/v1/auth/sign_out$} ]
    ]
    jwt.expiration_time = 24.hours.to_i
  end
end
