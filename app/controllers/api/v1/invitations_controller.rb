module Api
  module V1
    # Public endpoints: the emailed token is the credential.
    class InvitationsController < Api::V1::BaseController
      skip_before_action :authenticate_user!
      skip_before_action :set_current_context
      before_action :set_invited_user

      # GET /api/v1/invitations/:token
      def show
        render json: {
          email:             @user.email,
          first_name:        @user.first_name,
          last_name:         @user.last_name,
          role:              @user.role,
          organization_name: @user.organization.name
        }
      end

      # POST /api/v1/invitations/:token/accept
      def accept
        @user.accept_invitation!(
          password:              params.dig(:user, :password).to_s,
          password_confirmation: params.dig(:user, :password_confirmation).to_s
        )
        render json: { message: "Password set. You can now sign in." }
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      private

      # Unknown, used and expired tokens all look the same, so a token cannot be probed.
      def set_invited_user
        @user = User.find_by_invitation_token(params[:token])
        return if @user&.invitation_pending? && !@user.invitation_expired?

        render_error("This invitation is invalid or has expired. Ask your administrator for a new one.",
                     :not_found, code: "INVITATION_INVALID")
      end
    end
  end
end
