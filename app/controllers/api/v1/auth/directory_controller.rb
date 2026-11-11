module Api
  module V1
    module Auth
      # Public. What the sign-in screen offers (a button for the company account, a username field), and the start and the
      # end of signing in with OpenID Connect. The provider sends the person back to #callback, which never answers with
      # details of what went wrong: it sends the browser to the sign-in screen with a short code the screen has words for.
      class DirectoryController < ActionController::API
        include ActionController::Cookies

        STATE_COOKIE = :fixflow_oidc
        STATE_LIFETIME = 10.minutes

        # GET /api/v1/auth/directory
        def show
          render json: DirectorySettings.current.public_view
        end

        # GET /api/v1/auth/oidc/start: remember this browser's side of the sign-in, then off to the provider.
        def start
          settings = DirectorySettings.current
          return back_to_sign_in("not_set_up") unless settings.oidc?

          state = SecureRandom.urlsafe_base64(24)
          nonce = SecureRandom.urlsafe_base64(24)
          verifier = SecureRandom.urlsafe_base64(48)
          challenge = Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false)
          url = Directory::Oidc.new(settings).authorization_url(state: state, nonce: nonce, code_challenge: challenge)
          cookies.encrypted[STATE_COOKIE] = cookie_options(JSON.generate("state" => state, "nonce" => nonce, "verifier" => verifier))
          redirect_to url, allow_other_host: true
        rescue Directory::Error => e
          Rails.logger.warn "[Directory] could not start OpenID Connect sign-in: #{e.message}"
          back_to_sign_in("unreachable")
        end

        # GET /api/v1/auth/oidc/callback?code=&state=
        def callback
          saved = read_state
          cookies.delete(STATE_COOKIE, path: callback_path)
          return back_to_sign_in("denied") if params[:error].present?
          return back_to_sign_in("failed") unless saved && params[:code].is_a?(String) && params[:state].is_a?(String) &&
                                                  ActiveSupport::SecurityUtils.secure_compare(params[:state], saved["state"].to_s)

          settings = DirectorySettings.current
          return back_to_sign_in("not_set_up") unless settings.oidc?

          identity = Directory::Oidc.new(settings).identity_for(code: params[:code], code_verifier: saved["verifier"],
nonce: saved["nonce"])
          user = Directory::Accounts.sign_in!(identity, settings)
          redirect_to "#{EmailSetup.base_url}/login/directory?code=#{CGI.escape(Directory::LoginCode.issue(user))}",
allow_other_host: true
        rescue Directory::Refused => e
          Directory::Accounts.log_refused(e, identity, request)
          back_to_sign_in(e.code)
        rescue Directory::Error => e
          Rails.logger.warn "[Directory] OpenID Connect sign-in failed: #{e.message}"
          back_to_sign_in("unreachable")
        end

        private

        def read_state
          JSON.parse(cookies.encrypted[STATE_COOKIE].to_s)
        rescue JSON::ParserError
          nil
        end

        def cookie_options(value)
          { value: value, expires: STATE_LIFETIME.from_now, httponly: true, secure: Rails.env.production?, same_site: :lax,
path: callback_path }
        end

        def callback_path = "/api/v1/auth/oidc"

        def back_to_sign_in(code)
          redirect_to "#{EmailSetup.base_url}/login?directory_error=#{code}", allow_other_host: true
        end
      end
    end
  end
end
