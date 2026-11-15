module Api
  module V1
    module Ai
      # POST /api/v1/ai/work_order_draft  { text }
      # A draft work order from a few plain words, for the person to check (title, description, priority, and the asset when one of
      # the matches clearly is it). Only asks; saves nothing. Anyone who can create a work order can ask.
      class DraftsController < Api::V1::Ai::BaseController
        before_action :ensure_feature!

        def create
          authorize WorkOrder, :create?
          draft = ::Ai::WorkOrderDrafter.call(organization: current_organization, text: params.require(:text))
          render json: { data: payload(draft) }
        rescue ::Ai::WorkOrderDrafter::TooShort
          render_error("Say a little more about the problem.", :unprocessable_entity, code: "VALIDATION_ERROR")
        rescue ::Ai::Client::Error => e
          render_error(e.message, :unprocessable_entity, code: "AI_FAILED")
        end

        private

        def ensure_feature!
          return if ::Ai::Client.config(current_organization).feature?(:draft)

          render_error("Drafting a work order is switched off", :service_unavailable, code: "AI_FEATURE_OFF")
        end

        def payload(draft)
          {
            title: draft.title, description: draft.description, priority: draft.priority,
            asset: draft.asset && asset_hash(draft.asset),
            asset_candidates: draft.asset_candidates.map { |asset| asset_hash(asset) }
          }
        end

        def asset_hash(asset)
          { id: asset.id, name: asset.name, asset_tag: asset.asset_tag, location_path: asset.location&.full_path }
        end
      end
    end
  end
end
