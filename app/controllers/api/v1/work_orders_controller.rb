module Api
  module V1
    class WorkOrdersController < Api::V1::BaseController
      before_action :set_work_order, only: %i[show update destroy assign start complete verify reject hold cancel]
      before_action :require_manager!, only: %i[verify reject]

      ALLOWED_SORTS = %w[priority due_date created_at updated_at work_order_number].freeze

      # GET /api/v1/work_orders
      def index
        scope = apply_filters(current_organization.work_orders)
        scope = apply_sort(scope)
        pagy, work_orders = pagy(scope)
        render json: {
          work_orders: WorkOrderBlueprint.render_as_hash(work_orders),
          meta:        pagy_metadata_response(pagy)
        }
      end

      # GET /api/v1/work_orders/:id
      def show
        render json: WorkOrderBlueprint.render_as_hash(@work_order, view: :extended)
      end

      # POST /api/v1/work_orders
      def create
        work_order = current_organization.work_orders.create!(
          work_order_params.merge(requester: current_user)
        )
        render json: WorkOrderBlueprint.render_as_hash(work_order), status: :created
      end

      # PATCH /api/v1/work_orders/:id
      def update
        authorize_update!
        @work_order.update!(work_order_params)
        render json: WorkOrderBlueprint.render_as_hash(@work_order)
      end

      # DELETE /api/v1/work_orders/:id  →  cancel (preserves audit trail)
      def destroy
        require_manager!
        return if performed?
        @work_order.cancellation_reason = params[:cancellation_reason]
        fire_transition!(:cancel)
      end

      # ─── Lifecycle endpoints ─────────────────────────────────────────────

      # PATCH /api/v1/work_orders/:id/assign
      def assign
        require_manager!
        return if performed?
        assignee = current_organization.users.find(params[:assignee_id])
        @work_order.assignee = assignee
        fire_transition!(:assign)
      end

      # PATCH /api/v1/work_orders/:id/start
      def start
        authorize_assignee_or_manager!
        return if performed?
        fire_transition!(:start)
      end

      # PATCH /api/v1/work_orders/:id/complete
      def complete
        authorize_assignee_or_manager!
        return if performed?
        @work_order.completion_notes = params.dig(:work_order, :completion_notes) || params[:completion_notes]
        @work_order.actual_hours     = params.dig(:work_order, :actual_hours)     || params[:actual_hours]
        fire_transition!(:complete)
      end

      # PATCH /api/v1/work_orders/:id/verify
      def verify
        @work_order.verified_by = current_user
        fire_transition!(:verify)
      end

      # PATCH /api/v1/work_orders/:id/reject
      def reject
        @work_order.rejection_reason = params[:rejection_reason]
        fire_transition!(:reject)
      end

      # PATCH /api/v1/work_orders/:id/hold
      def hold
        authorize_assignee_or_manager!
        return if performed?
        fire_transition!(:hold)
      end

      # PATCH /api/v1/work_orders/:id/cancel
      def cancel
        require_manager!
        return if performed?
        @work_order.cancellation_reason = params[:cancellation_reason]
        fire_transition!(:cancel)
      end

      # GET /api/v1/work_orders/overdue
      def overdue
        pagy, work_orders = pagy(current_organization.work_orders.overdue.order(:due_date))
        render json: {
          work_orders: WorkOrderBlueprint.render_as_hash(work_orders),
          meta:        pagy_metadata_response(pagy)
        }
      end

      # GET /api/v1/work_orders/unassigned
      def unassigned
        pagy, work_orders = pagy(current_organization.work_orders.unassigned.open.order(created_at: :desc))
        render json: {
          work_orders: WorkOrderBlueprint.render_as_hash(work_orders),
          meta:        pagy_metadata_response(pagy)
        }
      end

      private

      def set_work_order
        @work_order = current_organization.work_orders.find(params[:id])
      end

      # ─── AASM transition helper ──────────────────────────────────────────

      def fire_transition!(event)
        unless @work_order.public_send(:"may_#{event}?")
          return render_error(
            "Cannot #{event.to_s.tr('_', ' ')} a work order with status '#{@work_order.status}'",
            status: :unprocessable_entity
          )
        end

        @work_order.public_send(:"#{event}!")

        if @work_order.valid?
          render json: WorkOrderBlueprint.render_as_hash(@work_order, view: :extended)
        else
          render json: { errors: @work_order.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # ─── Authorization helpers ───────────────────────────────────────────

      def authorize_update!
        return if current_user.manager_or_above?
        return if @work_order.assignee_id == current_user.id
        render_error("You can only update work orders assigned to you", status: :forbidden)
      end

      def authorize_assignee_or_manager!
        return if current_user.manager_or_above?
        return if @work_order.assignee_id == current_user.id
        render_error("Forbidden", status: :forbidden)
      end

      # ─── Filtering ───────────────────────────────────────────────────────

      def apply_filters(scope)
        if params[:status].present?
          scope = scope.by_status(params[:status].split(",").map(&:strip))
        end
        if params[:priority].present?
          scope = scope.by_priority(params[:priority].split(",").map(&:strip))
        end
        scope = scope.by_assignee(params[:assignee_id])   if params[:assignee_id].present?
        scope = scope.by_asset(params[:asset_id])         if params[:asset_id].present?
        scope = scope.overdue                             if params[:overdue] == "true"
        scope = scope.assigned_to(current_user.id)        if params[:my_work_orders] == "true"
        scope = scope.search_by_keyword(params[:search])  if params[:search].present?
        scope = scope.due_from(params[:due_date_from])    if params[:due_date_from].present?
        scope = scope.due_to(params[:due_date_to])        if params[:due_date_to].present?

        if params[:location_id].present?
          location  = current_organization.locations.find(params[:location_id])
          asset_ids = (location.subtree.flat_map { |l| l.assets.pluck(:id) }).uniq
          scope = scope.where(asset_id: asset_ids)
        end

        scope
      end

      def apply_sort(scope)
        col = ALLOWED_SORTS.include?(params[:sort]) ? params[:sort] : "created_at"
        dir = params[:order] == "asc" ? :asc : :desc
        scope.order(col => dir)
      end

      def work_order_params
        params.require(:work_order).permit(
          :title, :description, :priority, :asset_id, :assignee_id,
          :due_date, :estimated_hours, :actual_hours, :completion_notes,
          :rejection_reason, checklist: [ :step, :completed ]
        )
      end
    end
  end
end
