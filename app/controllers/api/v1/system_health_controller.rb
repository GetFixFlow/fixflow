module Api
  module V1
    # Whether this install is working, for administrators: the database, Redis, the background worker, email, the MQTT
    # broker, file storage and whether a newer release exists. (GET /health is the short public version that Docker's
    # health check uses; this one names servers and versions, so it is for administrators only.)
    class SystemHealthController < Api::V1::BaseController
      before_action :require_admin!

      # GET /api/v1/system_health
      def show
        response.set_header("Cache-Control", "no-store")
        render json: SystemHealth.new(current_organization).call
      end
    end
  end
end
