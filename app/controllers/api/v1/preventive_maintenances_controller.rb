module Api
  module V1
    class PreventiveMaintenancesController < Api::V1::BaseController
      before_action :require_manager!, only: %i[create update destroy pause resume trigger]
      before_action :load_trigger_overrides, only: :trigger
      before_action :set_pm, only: %i[show update destroy pause resume trigger preview]

      # GET /api/v1/preventive_maintenances
      def index
        scope = apply_pm_filters(current_organization.preventive_maintenances)
        pagy, pms = pagy(scope.order(:next_due_at))
        render json: {
          pm_schedules: PreventiveMaintenanceBlueprint.render_as_hash(pms),
          meta:         pagy_metadata_response(pagy)
        }
      end

      # GET /api/v1/preventive_maintenances/dashboard?date_range=90
      def dashboard
        days = params.fetch(:date_range, 90).to_i.clamp(7, 365)
        render json: PmDashboardService.new(current_organization, days: days).call
      end

      # GET /api/v1/preventive_maintenances/:id
      def show
        render json: { data: PreventiveMaintenanceBlueprint.render_as_hash(@pm, view: :extended) }
      end

      # POST /api/v1/preventive_maintenances
      def create
        pm = current_organization.preventive_maintenances.create!(pm_params)
        render json: { data: PreventiveMaintenanceBlueprint.render_as_hash(pm, view: :extended) },
          status: :created
      end

      # PATCH /api/v1/preventive_maintenances/:id
      def update
        @pm.update!(pm_params)
        render json: { data: PreventiveMaintenanceBlueprint.render_as_hash(@pm, view: :extended) }
      end

      # DELETE /api/v1/preventive_maintenances/:id → archive
      def destroy
        @pm.update!(status: :archived)
        head :no_content
      end

      # ─── Lifecycle ─────────────────────────────────────────────────────────

      # PATCH /api/v1/preventive_maintenances/:id/pause
      def pause
        return render_error("PM schedule is already paused", :unprocessable_entity) if @pm.status_paused?
        @pm.update!(status: :paused)
        render json: { data: PreventiveMaintenanceBlueprint.render_as_hash(@pm) }
      end

      # PATCH /api/v1/preventive_maintenances/:id/resume
      def resume
        return render_error("PM schedule is already active", :unprocessable_entity) if @pm.status_active?
        @pm.update!(status: :active)
        render json: { data: PreventiveMaintenanceBlueprint.render_as_hash(@pm) }
      end

      # PATCH /api/v1/preventive_maintenances/:id/trigger
      def trigger
        work_order = PmSchedulerService.generate_work_order(@pm, overrides: @trigger_overrides)
        render json: {
          message:    "Work order generated",
          work_order: WorkOrderBlueprint.render_as_hash(work_order)
        }, status: :created
      rescue => e
        render_error(e.message, :unprocessable_entity)
      end

      # GET /api/v1/preventive_maintenances/:id/preview
      def preview
        dates = PmSchedulerService.preview_schedule(@pm, count: 12)
        render json: { scheduled_dates: dates }
      end

      private

      def set_pm
        @pm = current_organization.preventive_maintenances.find(params[:id])
      end

      def apply_pm_filters(scope)
        scope = scope.where(status: params[:status]) if params[:status].present?
        scope = scope.where(priority: params[:priority]) if params[:priority].present?
        scope = scope.where(asset_id: params[:asset_id]) if params[:asset_id].present?
        scope = scope.overdue if params[:overdue] == "true"
        scope
      end

      def load_trigger_overrides
        @trigger_overrides = trigger_overrides
      end

      # Optional changes for a manually triggered work order (the "Advanced overrides" in the dialog).
      def trigger_overrides
        raw = params[:overrides]
        return {} if raw.blank?

        raw = raw.permit(:assignee_id, :due_date, :priority, :note)
        assignee = current_organization.users.active.find(raw[:assignee_id]) if raw[:assignee_id].present?
        { assignee: assignee, due_date: raw[:due_date].presence, priority: raw[:priority].presence, note: raw[:note] }.compact
      end

      def pm_params
        params.require(:preventive_maintenance).permit(
          :name, :description, :asset_id, :assigned_to_id, :priority,
          :frequency_type, :frequency_value, :frequency_unit,
          :start_date, :end_date, :estimated_hours,
          template: {}
        )
      end
    end
  end
end
