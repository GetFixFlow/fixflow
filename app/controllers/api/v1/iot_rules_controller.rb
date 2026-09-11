module Api
  module V1
    class IotRulesController < Api::V1::BaseController
      before_action :require_manager!, only: %i[create update destroy pause resume]
      before_action :set_rule, only: %i[show update destroy pause resume test]

      # GET /api/v1/iot_rules
      def index
        rules = current_organization.iot_rules.order(:name)
        rules = rules.where(status: params[:status])         if params[:status].present?
        rules = rules.for_asset(params[:asset_id])           if params[:asset_id].present?
        rules = rules.for_metric(params[:metric_name])       if params[:metric_name].present?
        render json: { iot_rules: IotRuleBlueprint.render_as_hash(rules) }
      end

      # GET /api/v1/iot_rules/:id
      def show
        render json: { data: IotRuleBlueprint.render_as_hash(@rule, view: :extended) }
      end

      # POST /api/v1/iot_rules
      def create
        rule = current_organization.iot_rules.create!(rule_params.merge(created_by: current_user))
        render json: { data: IotRuleBlueprint.render_as_hash(rule) }, status: :created
      end

      # PATCH /api/v1/iot_rules/:id
      def update
        @rule.update!(rule_params)
        render json: { data: IotRuleBlueprint.render_as_hash(@rule) }
      end

      # DELETE /api/v1/iot_rules/:id  — archives instead of hard delete
      def destroy
        @rule.update!(status: :archived)
        head :no_content
      end

      # PATCH /api/v1/iot_rules/:id/pause
      def pause
        @rule.update!(status: :paused)
        render json: { data: IotRuleBlueprint.render_as_hash(@rule) }
      end

      # PATCH /api/v1/iot_rules/:id/resume
      def resume
        @rule.update!(status: :active)
        render json: { data: IotRuleBlueprint.render_as_hash(@rule) }
      end

      # POST /api/v1/iot_rules/:id/test
      def test
        value = params.require(:value).to_f

        would_trigger    = Iot::RuleEvaluatorService.check_threshold(@rule, value)
        cooldown_active  = @rule.on_cooldown?
        would_create_wo  = would_trigger && !cooldown_active && @rule.auto_create_wo

        render json: {
          would_trigger:    would_trigger,
          current_value:    value,
          threshold:        @rule.threshold,
          threshold_max:    @rule.threshold_max,
          operator:         @rule.operator,
          cooldown_active:  cooldown_active,
          would_create_wo:  would_create_wo
        }
      end

      private

      def set_rule
        @rule = current_organization.iot_rules.find(params[:id])
      end

      def rule_params
        params.require(:iot_rule).permit(
          :name, :description, :asset_id, :metric_name,
          :operator, :threshold, :threshold_max, :unit,
          :status, :auto_create_wo, :wo_priority,
          :wo_title_template, :wo_description_template,
          :assigned_to_id, :cooldown_minutes,
          :sustained_duration_seconds
        )
      end
    end
  end
end
