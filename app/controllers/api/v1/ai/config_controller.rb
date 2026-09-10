module Api
  module V1
    module Ai
      # Deliberately does NOT inherit from Ai::BaseController — this endpoint
      # must stay reachable even when AI is disabled, so the frontend can learn
      # that and hide AI UI accordingly.
      class ConfigController < Api::V1::BaseController
        def show
          render_success({ enabled: ::Ai::Client.enabled?, model: ::Ai::Client.model })
        end
      end
    end
  end
end
