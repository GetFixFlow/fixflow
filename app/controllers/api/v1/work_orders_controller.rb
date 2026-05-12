module Api
  module V1
    class WorkOrdersController < Api::V1::BaseController
      before_action :set_work_order, only: %i[show update destroy assign transition complete]
      before_action :require_manager!, only: %i[destroy assign]

      VALID_TRANSITIONS = {
        "open"          => %w[in_progress],
        "in_progress"   => %w[pending_parts completed open],
        "pending_parts" => %w[in_progress],
        "completed"     => %w[verified open],
        "verified"      => []
      }.freeze

      def index
        scope = current_organization.work_orders
        scope = scope.by_priority(params[:priority]) if params[:priority]
        scope = scope.where(status: params[:status]) if params[:status]
        scope = scope.where(assignee_id: params[:assignee_id]) if params[:assignee_id]
        scope = scope.where(asset_id: params[:asset_id]) if params[:asset_id]
        pagy, work_orders = pagy(scope.order(created_at: :desc))
        render json: {
          work_orders: WorkOrderBlueprint.render_as_hash(work_orders),
          meta: pagy_metadata_response(pagy)
        }
      end

      def show
        render json: WorkOrderBlueprint.render_as_hash(@work_order, view: :extended)
      end

      def create
        work_order = current_organization.work_orders.create!(
          work_order_params.merge(requester: current_user)
        )
        render json: WorkOrderBlueprint.render_as_hash(work_order), status: :created
      end

      def update
        @work_order.update!(work_order_params)
        render json: WorkOrderBlueprint.render_as_hash(@work_order)
      end

      def destroy
        @work_order.destroy!
        head :no_content
      end

      def assign
        assignee = current_organization.users.find(params[:assignee_id])
        @work_order.update!(assignee: assignee)
        render json: WorkOrderBlueprint.render_as_hash(@work_order)
      end

      def transition
        new_status = params[:status]
        allowed = VALID_TRANSITIONS.fetch(@work_order.status, [])
        unless new_status.in?(allowed)
          return render json: { error: "Cannot transition from #{@work_order.status} to #{new_status}" },
            status: :unprocessable_entity
        end
        @work_order.update!(status: new_status)
        render json: WorkOrderBlueprint.render_as_hash(@work_order)
      end

      def complete
        @work_order.update!(
          status: "completed",
          completion_notes: params[:notes],
          completed_at: Time.current
        )
        render json: WorkOrderBlueprint.render_as_hash(@work_order)
      end

      def overdue
        pagy, work_orders = pagy(current_organization.work_orders.overdue.order(:due_date))
        render json: {
          work_orders: WorkOrderBlueprint.render_as_hash(work_orders),
          meta: pagy_metadata_response(pagy)
        }
      end

      def unassigned
        pagy, work_orders = pagy(current_organization.work_orders.unassigned.open.order(created_at: :desc))
        render json: {
          work_orders: WorkOrderBlueprint.render_as_hash(work_orders),
          meta: pagy_metadata_response(pagy)
        }
      end

      private

      def set_work_order
        @work_order = current_organization.work_orders.find(params[:id])
      end

      def work_order_params
        params.require(:work_order).permit(:title, :description, :priority, :status,
          :asset_id, :assignee_id, :due_date, :completion_notes,
          checklist: [ :step, :completed ])
      end
    end
  end
end
