module Api
  module V1
    module Ai
      # What the numbers say is coming: which sensors are heading for a limit, and which parts may run short. Statistics on this
      # server, so there is no model call and no rate limit. Each is one of the AI features an administrator can switch off.
      class ForecastsController < Api::V1::Ai::BaseController
        # The most rules looked at in one request.
        MAX_RULES = 200

        before_action :require_technician_or_above!
        before_action -> { ensure_feature!(:limits) }, only: :limits
        before_action -> { ensure_feature!(:parts) }, only: :parts

        # GET /api/v1/ai/forecasts/limits  (asset_id): the sensors heading for a limit, the soonest first
        def limits
          rules = IotRule.where(organization_id: current_organization.id, status: :active).includes(asset: :location).limit(MAX_RULES)
          rules = rules.where(asset_id: params[:asset_id]) if params[:asset_id].present?
          found = rules.filter_map { |rule| ::Forecast::LimitTrend.for_rule(rule) }.sort_by(&:days_left)
          render json: { data: found.map { |result| LimitForecastBlueprint.render_as_hash(result) } }
        end

        # GET /api/v1/ai/forecasts/parts: the parts worth a word, the ones that may run short first
        def parts
          visible = current_organization.parts.at_my_sites.pluck(:id)
          rows = ::Forecast::PartsDemand.for(current_organization).select { |row| visible.include?(row.part.id) }
          rows = rows.reject { |row| row.status == "ok" } unless params[:all] == "true"
          render json: { data: rows.map { |row| PartForecastBlueprint.render_as_hash(row) } }
        end

        private

        def ensure_feature!(name)
          return if ::Ai::Client.config(current_organization).feature?(name)

          render_error("This forecast is switched off", :service_unavailable, code: "AI_FEATURE_OFF")
        end
      end
    end
  end
end
