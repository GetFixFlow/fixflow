module Api
  module V1
    class IotRulesController < Api::V1::BaseController
      before_action :require_manager!, only: %i[create update destroy]
      before_action :set_rule, only: %i[show update destroy]

      def index
        rules = current_organization.iot_rules.active.order(:name)
        render json: { iot_rules: IotRuleBlueprint.render_as_hash(rules) }
      end

      def show
        render json: IotRuleBlueprint.render_as_hash(@rule)
      end

      def create
        rule = current_organization.iot_rules.create!(rule_params)
        render json: IotRuleBlueprint.render_as_hash(rule), status: :created
      end

      def update
        @rule.update!(rule_params)
        render json: IotRuleBlueprint.render_as_hash(@rule)
      end

      def destroy
        @rule.destroy!
        head :no_content
      end

      private

      def set_rule
        @rule = current_organization.iot_rules.find(params[:id])
      end

      def rule_params
        params.require(:iot_rule).permit(:name, :asset_id, :metric_name, :operator,
          :threshold, :priority, :auto_create_wo, :active,
          :duration_seconds, :work_order_title_template, :cooldown_minutes)
      end
    end
  end
end
