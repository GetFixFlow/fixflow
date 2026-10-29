module Api
  module V1
    module Auth
      class SessionsController < Devise::SessionsController
        include RecordsClient

        respond_to :json

        # Devise has signed the user out by the time respond_to_on_destroy runs, so
        # current_user is always nil there. Resolve the user from the JWT first.
        prepend_before_action :remember_signed_in_user, only: :destroy

        # A person with two-factor sign-in on is not signed in by their password alone: the password is checked here,
        # before Devise (which would start a session), and a challenge goes back to be sent with the code to
        # POST /api/v1/auth/two_factor. A wrong password, or a person without two-factor, carries on to Devise as before.
        prepend_before_action :ask_for_second_factor, only: :create

        private

        def remember_signed_in_user
          @signed_in_user = current_user
        end

        def ask_for_second_factor
          credentials = params[:user]
          return unless credentials.respond_to?(:[]) && credentials[:email].is_a?(String) && credentials[:password].is_a?(String)

          user = User.find_for_authentication(email: credentials[:email])
          return unless user&.two_factor_enabled? && user.valid_password?(credentials[:password])

          # A right password counts for the lock as it does for anyone (it resets the count of wrong ones). A locked or
          # deactivated account carries on to Devise, which refuses it with the reason. A wrong password is counted there.
          return unless user.valid_for_authentication? { true } && user.active_for_authentication?

          render json: { two_factor_required: true, challenge: TwoFactorChallenge.issue(user),
                         message: "Enter the code from your authenticator app." }
        end

        def respond_with(resource, _opts = {})
          render json: {
            message: "Logged in successfully",
            user: UserBlueprint.render_as_hash(resource)
          }, status: :ok
        end

        # Devise 5 passes non_navigational_status; we always answer with JSON.
        def respond_to_on_destroy(**)
          if @signed_in_user
            render json: { message: "Logged out successfully" }, status: :ok
          else
            render json: { message: "No active session" }, status: :unauthorized
          end
        end
      end
    end
  end
end
