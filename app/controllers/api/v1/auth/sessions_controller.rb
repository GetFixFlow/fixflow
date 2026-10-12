module Api
  module V1
    module Auth
      class SessionsController < Devise::SessionsController
        respond_to :json

        # Devise has signed the user out by the time respond_to_on_destroy runs, so
        # current_user is always nil there. Resolve the user from the JWT first.
        prepend_before_action :remember_signed_in_user, only: :destroy

        private

        def remember_signed_in_user
          @signed_in_user = current_user
        end

        def respond_with(resource, _opts = {})
          render json: {
            message: "Logged in successfully",
            user: UserBlueprint.render_as_hash(resource)
          }, status: :ok
        end

        def respond_to_on_destroy
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
