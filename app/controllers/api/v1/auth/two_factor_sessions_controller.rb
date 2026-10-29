module Api
  module V1
    module Auth
      # POST /api/v1/auth/two_factor: the second step of signing in. Takes the challenge the password step returned and
      # a code from the authenticator app (or a recovery code); on success it signs in exactly as sign_in does, and
      # devise-jwt adds the token to the response.
      class TwoFactorSessionsController < Devise::SessionsController
        include RecordsClient

        respond_to :json

        def create
          user = TwoFactorChallenge.user_for(params[:challenge])
          unless user&.active_for_authentication? && user.two_factor_enabled?
            return render json: { error: "Sign in again: this step has expired.", code: "TWO_FACTOR_CHALLENGE_INVALID" },
                          status: :unauthorized
          end

          kind = user.verify_second_factor!(params[:code])
          return render_wrong_code(user) unless kind

          ActivityLogService.log(action: "user.recovery_code_used", resource: user, user: user) if kind == :recovery_code
          sign_in(:user, user)
          render json: { message: "Logged in successfully", user: UserBlueprint.render_as_hash(user) }
        rescue TwoFactorAuth::Locked => e
          ActivityLogService.log(action: "user.two_factor_locked", resource: user, user: user, request: request)
          render json: { error: e.message, code: "TWO_FACTOR_LOCKED" }, status: :too_many_requests
        end

        private

        def render_wrong_code(user)
          ActivityLogService.log(action: "user.two_factor_failed", resource: user, user: user, request: request)
          render json: { error: "That code is not right.", code: "TWO_FACTOR_INVALID" }, status: :unauthorized
        end
      end
    end
  end
end
