module Api
  module V1
    module Ai
      class BaseController < Api::V1::BaseController
        before_action :require_technician_or_above!
        before_action :ensure_ai_enabled!

        private

        def ensure_ai_enabled!
          return if ::Ai::Client.enabled?(current_organization)

          render_error("AI features are currently disabled", :service_unavailable, code: "AI_DISABLED")
        end
      end
    end
  end
end
