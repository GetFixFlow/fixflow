module Api
  module V1
    class PmExecutionsController < Api::V1::BaseController
      before_action :set_pm

      # GET /api/v1/preventive_maintenances/:preventive_maintenance_id/executions
      def index
        pagy, execs = pagy(@pm.pm_executions.recent)
        render json: {
          executions: PmExecutionBlueprint.render_as_hash(execs),
          meta:       pagy_metadata_response(pagy)
        }
      end

      # PATCH /api/v1/preventive_maintenances/:preventive_maintenance_id/executions/:id/skip
      def skip
        exec = @pm.pm_executions.find(params[:id])

        return render_error("Execution is not pending", status: :unprocessable_entity) unless exec.status_pending?

        exec.update!(
          status:      :skipped,
          skip_reason: params[:skip_reason].presence || "Skipped manually"
        )
        @pm.increment!(:times_skipped)

        render json: PmExecutionBlueprint.render_as_hash(exec)
      end

      private

      def set_pm
        @pm = current_organization.preventive_maintenances.find(params[:preventive_maintenance_id])
      end
    end
  end
end
