module Api
  module V1
    # The signed-in user's own profile. Email stays read-only here: changing it would
    # need a confirmation step this app does not have yet.
    class ProfileController < Api::V1::BaseController
      skip_before_action :require_two_factor_when_company_does, only: :show

      # GET /api/v1/profile
      def show
        render json: { user: serialized_user }
      end

      # PATCH /api/v1/profile
      def update
        current_user.update!(profile_params)
        render json: { user: serialized_user }
      end

      # PATCH /api/v1/profile/password
      # Changing the password signs the user out everywhere: every issued token carries
      # the old jti, so rotating it revokes them all, this session's included.
      def password
        attrs = params.expect(user: %i[current_password password password_confirmation])

        return render_error("Password can't be blank", :unprocessable_entity, code: "VALIDATION_ERROR") if attrs[:password].blank?

        unless current_user.update_with_password(attrs)
          return render_error(current_user.errors.full_messages.first, :unprocessable_entity,
                              code: "VALIDATION_ERROR", details: current_user.errors.as_json)
        end

        current_user.update!(jti: SecureRandom.uuid)
        render json: { message: "Password changed. Please sign in again." }
      end

      private

      def profile_params
        params.expect(user: %i[full_name phone job_title department])
      end

      def serialized_user
        UserBlueprint.render_as_hash(current_user, view: :extended)
      end
    end
  end
end
