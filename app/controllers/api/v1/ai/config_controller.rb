module Api
  module V1
    module Ai
      # Deliberately does NOT inherit from Ai::BaseController — this endpoint
      # must stay reachable even when AI is disabled, so the frontend can learn
      # that and hide AI UI accordingly.
      class ConfigController < Api::V1::BaseController
        def show
          config = ::Ai::Client.config(current_organization)
          render_success({ enabled: config.active?, model: config.model, provider: config.provider, source: config.source })
        end
      end
    end
  end
end
