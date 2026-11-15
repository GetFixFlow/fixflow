module Api
  module V1
    module Ai
      # POST /api/v1/ai/priority  { title, description, asset_id }
      # A priority for a work order being written. Only asks; saves nothing. Anyone who can create a work order can ask.
      class PriorityController < Api::V1::Ai::BaseController
        before_action :ensure_feature!

        def create
          authorize WorkOrder, :create?
          title = params.require(:title).to_s
          asset = current_organization.assets.find(params[:asset_id]) if params[:asset_id].present?

          suggestion = ::Ai::PrioritySuggester.call(organization: current_organization, title: title,
                                                    description: params[:description], asset: asset)
          render json: { data: { priority: suggestion.priority, reason: suggestion.reason } }
        rescue ::Ai::Client::Error => e
          render_error(e.message, :unprocessable_entity, code: "AI_FAILED")
        end

        private

        def ensure_feature!
          return if ::Ai::Client.config(current_organization).feature?(:priority)

          render_error("Suggesting a priority is switched off", :service_unavailable, code: "AI_FEATURE_OFF")
        end
      end
    end
  end
end
