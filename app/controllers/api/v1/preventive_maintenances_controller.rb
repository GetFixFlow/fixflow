module Api
  module V1
    class PreventiveMaintenancesController < Api::V1::BaseController
      before_action :require_manager!, only: %i[create update destroy trigger]
      before_action :set_pm, only: %i[show update destroy trigger]

      def index
        scope = current_organization.preventive_maintenances.active
        pagy, pms = pagy(scope.order(:next_due_at))
        render json: {
          pm_schedules: PreventiveMaintenanceBlueprint.render_as_hash(pms),
          meta: pagy_metadata_response(pagy)
        }
      end

      def due
        pms = current_organization.preventive_maintenances.due.order(:next_due_at)
        render json: { pm_schedules: PreventiveMaintenanceBlueprint.render_as_hash(pms) }
      end

      def show
        render json: PreventiveMaintenanceBlueprint.render_as_hash(@pm)
      end

      def create
        pm = current_organization.preventive_maintenances.create!(pm_params)
        render json: PreventiveMaintenanceBlueprint.render_as_hash(pm), status: :created
      end

      def update
        @pm.update!(pm_params)
        render json: PreventiveMaintenanceBlueprint.render_as_hash(@pm)
      end

      def destroy
        @pm.destroy!
        head :no_content
      end

      def trigger
        PmWorkOrderGeneratorJob.perform_later(@pm.id)
        render json: { message: "PM work order generation triggered" }
      end

      private

      def set_pm
        @pm = current_organization.preventive_maintenances.find(params[:id])
      end

      def pm_params
        params.require(:preventive_maintenance).permit(
          :name, :asset_id, :frequency_type, :frequency_value,
          :frequency_unit, :next_due_at, :active, template: {}
        )
      end
    end
  end
end
