module Api
  module V1
    module Ai
      class BaseController < Api::V1::BaseController
        before_action :ensure_ai_enabled!

        private

        def ensure_ai_enabled!
          return if ::Ai::Client.enabled?

          render_error("AI features are currently disabled", :service_unavailable, code: "AI_DISABLED")
        end
      end
    end
  end
end
