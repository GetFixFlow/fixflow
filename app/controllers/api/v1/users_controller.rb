module Api
  module V1
    class UsersController < Api::V1::BaseController
      before_action :require_manager!, only: %i[index update destroy]
      before_action :set_user, only: %i[show update destroy]

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

      def destroy
        require_admin!
        @user.destroy!
        head :no_content
      end

      private

      def set_user
        @user = current_organization.users.find(params[:id])
      end

      def user_params
        allowed = [ :first_name, :last_name, :phone ]
        allowed << :role if current_user.admin?
        params.require(:user).permit(allowed)
      end
    end
  end
end
