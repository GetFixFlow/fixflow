module Api
  module V1
    class PreventiveMaintenancesController < Api::V1::BaseController
      before_action :require_manager!, only: %i[create update destroy pause resume trigger]
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

      # GET /api/v1/preventive_maintenances/dashboard
      def dashboard
        org = current_organization
        pms = org.preventive_maintenances

        active_pms   = pms.status_active
        overdue_pms  = active_pms.overdue.includes(:asset)
        due_this_week = active_pms.due_within(7).includes(:asset)

        render json: {
          summary: {
            total_active:          active_pms.count,
            due_this_week:         due_this_week.count,
            overdue:               overdue_pms.count,
            completed_this_month:  this_month_completed_count(pms),
            compliance_rate:       compliance_rate(pms)
          },
          overdue_pms:   overdue_pm_list(overdue_pms),
          due_this_week: due_this_week_list(due_this_week),
          compliance_by_location: compliance_by_location(pms),
          recent_executions: recent_executions_list(pms)
        }
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
        work_order = PmSchedulerService.generate_work_order(@pm)
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

      def pm_params
        params.require(:preventive_maintenance).permit(
          :name, :description, :asset_id, :assigned_to_id, :priority,
          :frequency_type, :frequency_value, :frequency_unit,
          :start_date, :end_date, :estimated_hours,
          template: {}
        )
      end

      # ─── Dashboard helpers ─────────────────────────────────────────────────

      def this_month_completed_count(pms)
        PmExecution
          .where(preventive_maintenance: pms)
          .where(status: :completed)
          .where(scheduled_date: Time.current.beginning_of_month..)
          .count
      end

      def compliance_rate(pms)
        ninety_days_ago = 90.days.ago.to_date
        execs = PmExecution
          .where(preventive_maintenance: pms)
          .where(scheduled_date: ninety_days_ago..)
          .where(status: %i[generated skipped completed])

        total     = execs.count
        completed = execs.where(status: :completed).count
        return 0.0 if total.zero?

        (completed.to_f / total * 100).round(1)
      end

      def overdue_pm_list(overdue_pms)
        overdue_pms.map do |pm|
          days_overdue = (Date.today - pm.next_due_at.to_date).to_i
          {
            id:          pm.id,
            name:        pm.name,
            asset:       pm.asset&.name,
            next_due_at: pm.next_due_at,
            days_overdue: days_overdue
          }
        end
      end

      def due_this_week_list(due_this_week)
        due_this_week.map do |pm|
          {
            id:          pm.id,
            name:        pm.name,
            asset:       pm.asset&.name,
            next_due_at: pm.next_due_at,
            priority:    pm.priority
          }
        end
      end

      def compliance_by_location(pms)
        ninety_days_ago = 90.days.ago.to_date

        pms.includes(asset: :location)
          .group_by { |pm| pm.asset&.location&.name || "Unknown" }
          .map do |location, loc_pms|
            execs = PmExecution
              .where(preventive_maintenance: loc_pms)
              .where(scheduled_date: ninety_days_ago..)
              .where(status: %i[generated skipped completed])

            total     = execs.count
            completed = execs.where(status: :completed).count
            rate      = total.zero? ? 100.0 : (completed.to_f / total * 100).round(1)

            { location: location, rate: rate }
          end
          .sort_by { |h| -h[:rate] }
      end

      def recent_executions_list(pms)
        execs = PmExecution
          .where(preventive_maintenance: pms)
          .where.not(work_order_id: nil)
          .includes(:work_order, :preventive_maintenance)
          .order(generated_at: :desc)
          .limit(10)

        PmExecutionBlueprint.render_as_hash(execs)
      end
    end
  end
end
