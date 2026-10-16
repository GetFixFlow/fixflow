module Api
  module V1
    class IotRulesController < Api::V1::BaseController
      before_action :require_manager!, only: %i[create update destroy pause resume archive duplicate test]
      before_action :set_rule, only: %i[show update destroy pause resume archive duplicate test]

      RULE_FIELDS = %i[
        name description asset_id metric_name operator threshold threshold_max unit status
        auto_create_wo wo_priority wo_title_template wo_description_template assigned_to_id
        cooldown_minutes sustained_duration_seconds
      ].freeze
      # The rule form's names for the same things.
      RULE_FORM_FIELDS = %i[threshold_value threshold_min metric_unit sustained_minutes wo_assignee_id].freeze

      # GET /api/v1/iot_rules
      def index
        rules = current_organization.iot_rules.order(:name)
        rules = rules.where(status: params[:status])         if params[:status].present?
        rules = rules.for_asset(params[:asset_id])           if params[:asset_id].present?
        rules = rules.for_metric(params[:metric_name])       if params[:metric_name].present?
        render json: { iot_rules: IotRuleBlueprint.render_as_hash(rules.includes(:asset)) }
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

      # PATCH /api/v1/iot_rules/:id/archive  (the same as DELETE: nothing is lost, the rule just stops)
      def archive
        @rule.update!(status: :archived)
        render json: { data: IotRuleBlueprint.render_as_hash(@rule, view: :extended) }
      end

      # POST /api/v1/iot_rules/:id/duplicate  makes a paused copy
      def duplicate
        copy = @rule.duplicate!
        render json: { data: IotRuleBlueprint.render_as_hash(copy, view: :extended) }, status: :created
      end

      # PATCH /api/v1/iot_rules/:id/resume
      def resume
        @rule.update!(status: :active)
        render json: { data: IotRuleBlueprint.render_as_hash(@rule) }
      end

      # POST /api/v1/iot_rules/:id/test  { test_value }  what would happen if a sensor read this
      def test
        value = Float(params[:test_value].presence || params[:value].presence, exception: false)
        return render_error("test_value must be a number", :unprocessable_entity, code: "VALIDATION_ERROR") unless value

        cooldown_active = @rule.on_cooldown?
        would_trigger   = @rule.breach?(value)

        render json: {
          would_trigger:    would_trigger,
          reason:           @rule.explain(value, cooldown_active: cooldown_active),
          current_value:    value,
          threshold:        @rule.threshold,
          threshold_max:    @rule.threshold_max,
          operator:         @rule.operator,
          cooldown_active:  cooldown_active,
          would_create_wo:  would_trigger && !cooldown_active && @rule.active? && @rule.auto_create_wo,
          recent_readings:  recent_readings
        }
      end

      private

      def set_rule
        @rule = current_organization.iot_rules.find(params[:id])
      end

      # What a sensor read lately, and whether each reading would have set the rule off.
      def recent_readings
        SensorReading.where(asset_id: @rule.asset_id, metric_name: @rule.metric_name).order(recorded_at: :desc).limit(5)
                     .map do |reading|
          { value: reading.value.to_f, unit: reading.unit, recorded_at: reading.recorded_at,
would_trigger: @rule.breach?(reading.value) }
        end
      end

      # The rule form posts threshold_value, metric_unit and so on; the columns are called threshold, unit...
      # Either set of names works, and a column's own name wins when both are sent.
      def rule_params
        permitted = params.require(:iot_rule).permit(*RULE_FIELDS, *RULE_FORM_FIELDS)
        form = permitted.extract!(*RULE_FORM_FIELDS)

        permitted[:unit] ||= form[:metric_unit] if form.key?(:metric_unit)
        permitted[:assigned_to_id] ||= form[:wo_assignee_id].presence if form.key?(:wo_assignee_id)
        permitted[:sustained_duration_seconds] ||= minutes_to_seconds(form[:sustained_minutes]) if form.key?(:sustained_minutes)
        limit = lower_limit_key(permitted)
        permitted[:threshold] = form[limit] if !permitted.key?(:threshold) && form.key?(limit)
        permitted
      end

      # An "outside range" rule's lower limit is the form's threshold_min; any other rule's only limit is threshold_value.
      def lower_limit_key(permitted)
        (permitted[:operator] || @rule&.operator).to_s == "outside_range" ? :threshold_min : :threshold_value
      end

      def minutes_to_seconds(minutes)
        return if minutes.blank?

        seconds = Float(minutes, exception: false)
        raise ActionController::BadRequest, "sustained_minutes must be a number" unless seconds

        (seconds * 60).round
      end
    end
  end
end
