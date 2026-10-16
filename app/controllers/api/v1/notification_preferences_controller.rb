module Api
  module V1
    # The emails the signed-in person wants. Each person manages their own; there is nothing
    # an administrator sets for someone else.
    class NotificationPreferencesController < Api::V1::BaseController
      # GET /api/v1/notification_preferences
      def show
        render json: { preferences: current_user.email_preferences }
      end

      # PATCH /api/v1/notification_preferences  { preferences: { email_enabled, rules: { wo_assigned: { email } } } }
      def update
        current_user.update_email_preferences!(preferences_params)
        render json: { preferences: current_user.email_preferences }
      end

      private

      def preferences_params
        params.expect(preferences: [:email_enabled, { rules: {} }])
      end
    end
  end
end
