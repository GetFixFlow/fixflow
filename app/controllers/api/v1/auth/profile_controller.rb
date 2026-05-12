module Api
  module V1
    module Auth
      class ProfileController < Api::V1::BaseController
        def show
          render json: UserBlueprint.render_as_hash(current_user, view: :extended)
        end
      end
    end
  end
end
