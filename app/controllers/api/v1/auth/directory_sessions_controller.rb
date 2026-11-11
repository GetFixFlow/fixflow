module Api
  module V1
    module Auth
      # POST /api/v1/auth/directory { code }: the last step of signing in through OpenID Connect. Takes the note the
      # callback handed the browser and, if it is good, signs in exactly as sign_in does (devise-jwt adds the token).
      class DirectorySessionsController < Devise::SessionsController
        include RecordsClient

        respond_to :json

        def create
          user = Directory::LoginCode.redeem(params[:code])
          unless user&.active_for_authentication?
            return render json: { error: "Sign in again: this step has expired.", code: "DIRECTORY_CODE_INVALID" },
status: :unauthorized
          end

          sign_in(:user, user)
          render json: { message: "Logged in successfully", user: UserBlueprint.render_as_hash(user) }
        end
      end
    end
  end
end
