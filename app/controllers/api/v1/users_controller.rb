module Api
  module V1
    class UsersController < Api::V1::BaseController
      before_action :require_manager!, only: %i[index update destroy]
      before_action :require_admin!,   only: %i[invite resend_invitation]
      before_action :set_user, only: %i[show update destroy resend_invitation]

      def index
        scope = current_organization.users
        scope = scope.by_role(params[:role]) if params[:role]
        pagy, users = pagy(scope.order(:first_name, :last_name))
        render json: {
          users: UserBlueprint.render_as_hash(users),
          meta: pagy_metadata_response(pagy)
        }
      end

      def me
        render json: UserBlueprint.render_as_hash(current_user, view: :extended)
      end

      def show
        render json: UserBlueprint.render_as_hash(@user)
      end

      def update
        @user.update!(user_params)
        render json: UserBlueprint.render_as_hash(@user)
      end

      # POST /api/v1/users/invite
      # Always returns the invitation link, so an admin can send it by hand when
      # email is not set up. The email is only attempted when it is.
      def invite
        user = nil
        raw_token = nil
        ActiveRecord::Base.transaction do
          password = SecureRandom.hex(32) # unusable until the invitee sets their own
          user = current_organization.users.create!(
            invite_params.merge(password: password, password_confirmation: password)
          )
          raw_token = user.invite!(invited_by: current_user)
        end

        render json: invitation_payload(user, raw_token, send_email: send_welcome?), status: :created
      end

      # POST /api/v1/users/:id/resend_invitation — replaces the old link with a new one
      def resend_invitation
        unless @user.invitation_pending?
          return render_error("This user has already accepted their invitation.",
                              :unprocessable_entity, code: "INVITATION_ACCEPTED")
        end

        raw_token = @user.invite!(invited_by: current_user)
        render json: invitation_payload(@user, raw_token, send_email: send_welcome?)
      end

      def destroy
        require_admin!
        return if performed?
        @user.destroy!
        head :no_content
      end

      private

      def set_user
        @user = current_organization.users.find(params[:id])
      end

      def invite_params
        params.require(:user).permit(:email, :first_name, :last_name, :role)
      end

      def send_welcome?
        ActiveModel::Type::Boolean.new.cast(params.dig(:user, :send_welcome)) != false
      end

      def invitation_payload(user, raw_token, send_email:)
        url = invitation_url_for(raw_token)
        email_sent = send_email && Invitations.email_configured?
        if email_sent
          InvitationMailer.invite(user, url, params.dig(:user, :message).to_s.first(500)).deliver_later
        end
        { user: UserBlueprint.render_as_hash(user), invitation_url: url, email_sent: email_sent }
      end

      def invitation_url_for(raw_token)
        "#{Invitations.base_url}/accept-invite?token=#{raw_token}"
      end

      def user_params
        allowed = [ :first_name, :last_name, :phone ]
        allowed << :role if current_user.admin?
        params.require(:user).permit(allowed)
      end
    end
  end
end
