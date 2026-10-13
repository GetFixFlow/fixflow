module Api
  module V1
    class SetupController < Api::V1::BaseController
      skip_before_action :authenticate_user!
      skip_before_action :set_current_context

      # Lets the web app decide between the first-run setup screen and the login screen.
      def status
        render json: { setup_required: !Organization.setup_complete?, email_configured: EmailSetup.configured? }
      end
    end
  end
end
