module Api
  module V1
    class UsersController < Api::V1::BaseController
      before_action :require_manager!, only: %i[index update]
      before_action :require_admin!,   only: %i[invite resend_invitation destroy deactivate reactivate role
                                                bulk_role bulk_deactivate reset_password reset_two_factor]
      before_action :set_user, only: %i[show update destroy resend_invitation deactivate reactivate role reset_password
                                        reset_two_factor]

      rescue_from UserAdministration::Refused do |error|
        render_error(error.message, :unprocessable_entity, code: "USER_ACTION_REFUSED")
      end

      def index
        scope = current_organization.users
        scope = scope.by_role(params[:role]) if params[:role]
        pagy, users = pagy(scope.order(:first_name, :last_name))
        render json: {
          users: UserBlueprint.render_as_hash(users, show_rate: current_user.admin?),
          meta: pagy_metadata_response(pagy)
        }
      end

      def me
        render json: UserBlueprint.render_as_hash(current_user, view: :extended)
      end

      def show
        render json: UserBlueprint.render_as_hash(@user, show_rate: current_user.admin?)
      end

      # Managers edit details; only admins change a role, and that goes through the
      # same safeguards as the role endpoint.
      def update
        ActiveRecord::Base.transaction do
          @user.update!(user_params) if user_params.present?
          role = params.dig(:user, :role)
          UserAdministration.change_role!(@user, role, by: current_user) if role.present? && current_user.admin?
        end
        render json: UserBlueprint.render_as_hash(@user, show_rate: current_user.admin?)
      end

      # PATCH /api/v1/users/:id/deactivate
      def deactivate
        UserAdministration.deactivate!(@user, by: current_user)
        render json: { user: UserBlueprint.render_as_hash(@user) }
      end

      # PATCH /api/v1/users/:id/reactivate
      def reactivate
        UserAdministration.reactivate!(@user)
        render json: { user: UserBlueprint.render_as_hash(@user) }
      end

      # POST /api/v1/users/:id/reset_two_factor
      def reset_two_factor
        UserAdministration.reset_two_factor!(@user, by: current_user)
        render json: { user: UserBlueprint.render_as_hash(@user.reload) }
      end

      # POST /api/v1/users/:id/reset_password
      # Gives the admin a link to hand over, and emails it when email is set up. The person's
      # current password keeps working until the link is used.
      def reset_password
        ensure_can_reset!(@user)
        url = @user.reset_password_url
        email_sent = EmailSetup.configured?
        PasswordMailer.reset(@user, url).deliver_later if email_sent
        render json: { reset_url: url, email_sent: email_sent }
      end

      # PATCH /api/v1/users/:id/role
      def role
        UserAdministration.change_role!(@user, params[:role], by: current_user)
        render json: { user: UserBlueprint.render_as_hash(@user) }
      end

      # PATCH /api/v1/users/bulk_role: all or nothing
      def bulk_role
        users = users_from_ids
        bulk_apply(users) { |user| UserAdministration.change_role!(user, params[:role], by: current_user) }
        render json: { users: UserBlueprint.render_as_hash(users) }
      end

      # PATCH /api/v1/users/bulk_deactivate: all or nothing
      def bulk_deactivate
        users = users_from_ids
        bulk_apply(users) { |user| UserAdministration.deactivate!(user, by: current_user) }
        render json: { users: UserBlueprint.render_as_hash(users) }
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
        UserAdministration.delete!(@user, by: current_user)
        head :no_content
      end

      private

      def ensure_can_reset!(user)
        refusal =
          if user.id == current_user.id then "You can change your own password in My Profile."
          elsif user.invitation_pending? then "#{user.full_name} has not accepted their invitation yet. Send a new invitation instead."
          elsif !user.active? then "#{user.full_name} is deactivated."
          end
        raise UserAdministration::Refused, refusal if refusal
      end

      def set_user
        @user = current_organization.users.find(params[:id])
      end

      def invite_params
        # Only admins reach #invite. The role is checked against User::ROLES by the model.
        allowed = [ :email, :first_name, :last_name ]
        allowed << :role
        params.require(:user).permit(allowed)
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
        allowed = %i[full_name first_name last_name phone job_title department]
        allowed << :hourly_rate if current_user.admin? # what someone is paid is the administrator's to set
        params.fetch(:user, {}).permit(allowed)
      end

      # The people named by params[:ids], all from this company or none.
      def users_from_ids
        ids = Array(params[:ids]).map(&:to_i).uniq
        users = current_organization.users.where(id: ids).order(:id).to_a
        raise ActiveRecord::RecordNotFound if users.size != ids.size || ids.empty?

        users
      end

      def bulk_apply(users)
        ActiveRecord::Base.transaction do
          users.each do |user|
            yield user
          rescue UserAdministration::Refused => e
            raise UserAdministration::Refused, "#{user.full_name}: #{e.message}"
          end
        end
      end
    end
  end
end
