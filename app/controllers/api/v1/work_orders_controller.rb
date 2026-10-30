module Api
  module V1
    class WorkOrdersController < Api::V1::BaseController
      before_action :set_work_order, only: %i[show update destroy assign start complete verify reject hold cancel transition]
      before_action :require_manager!, only: %i[verify reject]
      before_action :require_manager_for_vendor!, only: %i[create update]

      # The vendor who did the work, what they charged and their invoice number: a manager's to enter.
      VENDOR_FIELDS = %w[vendor_id vendor_cost vendor_reference].freeze
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
        render json: { data: WorkOrderBlueprint.render_as_hash(@work_order, view: :extended, labor: current_user.manager_or_above?) }
      end

      # POST /api/v1/work_orders
      def create
        attrs = work_order_params
        attrs[:priority] = current_organization.default_priority if attrs[:priority].blank?
        attrs[:due_date] = current_organization.default_due_days.days.from_now if attrs[:due_date].blank?
        work_order = current_organization.work_orders.create!(attrs.merge(requester: current_user))
        render json: { data: WorkOrderBlueprint.render_as_hash(work_order) }, status: :created
      end

      # PATCH /api/v1/work_orders/:id
      def update
        authorize_update!
        return if performed?
        attrs = work_order_params
        if attrs.key?(:checklist)
          if @work_order.checklist_locked?
            return render_error("This work order is #{@work_order.status}, so its checklist can no longer be changed.",
                                :unprocessable_entity, code: "CHECKLIST_LOCKED")
          end
          attrs[:checklist] = merge_checklist(attrs[:checklist])
        end
        @work_order.update!(attrs)
        render json: { data: WorkOrderBlueprint.render_as_hash(@work_order) }
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

      # PATCH /api/v1/work_orders/:id/transition
      #
      # Unified lifecycle endpoint used by the frontend (one mutation for every
      # status change) — dispatches to the same AASM events + authorization
      # rules as the individual assign/start/complete/... actions above.
      def transition
        event = params[:event].to_s
        wo_payload = params[:work_order] || {}

        case event
        when "assign_self"
          return if performed?
          @work_order.assignee = current_user
          fire_transition!(:assign)
        when "assign"
          require_manager!
          return if performed?
          fire_transition!(:assign)
        when "start"
          authorize_assignee_or_manager!
          return if performed?
          fire_transition!(:start)
        when "hold"
          authorize_assignee_or_manager!
          return if performed?
          fire_transition!(:hold)
        when "need_parts", "pending_parts"
          authorize_assignee_or_manager!
          return if performed?
          fire_transition!(:need_parts)
        when "resume"
          authorize_assignee_or_manager!
          return if performed?
          fire_transition!(:resume)
        when "complete"
          authorize_assignee_or_manager!
          return if performed?
          @work_order.completion_notes = wo_payload[:completion_notes] || params[:completion_notes]
          @work_order.actual_hours     = wo_payload[:actual_hours]     || params[:actual_hours]
          fire_transition!(:complete)
        when "verify"
          require_manager!
          return if performed?
          @work_order.verified_by = current_user
          fire_transition!(:verify)
        when "reject"
          require_manager!
          return if performed?
          @work_order.rejection_reason = wo_payload[:rejection_reason] || params[:rejection_reason]
          fire_transition!(:reject)
        when "cancel"
          require_manager!
          return if performed?
          @work_order.cancellation_reason = wo_payload[:cancellation_reason] || params[:cancellation_reason]
          fire_transition!(:cancel)
        else
          render_error("Unknown transition event: #{event}", :unprocessable_entity, code: "INVALID_TRANSITION")
        end
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
        return render_unfinished_checklist if event == :complete && @work_order.incomplete_required_steps.any?

        unless @work_order.public_send(:"may_#{event}?")
          return render_error(
            "Cannot #{event.to_s.tr('_', ' ')} a work order with status '#{@work_order.status}'",
            :unprocessable_entity
          )
        end

        @work_order.public_send(:"#{event}!")

        if @work_order.valid?
          render json: { data: WorkOrderBlueprint.render_as_hash(@work_order, view: :extended, labor: current_user.manager_or_above?) }
        else
          render json: { errors: @work_order.errors.full_messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      # Work cannot be completed with required checklist steps undone. Says which ones, so the
      # technician can go and do them.
      def render_unfinished_checklist
        missing = @work_order.incomplete_required_steps
        render_error("Complete the required steps first: #{missing.pluck('instruction').join('; ')}", :unprocessable_entity,
                     code: "CHECKLIST_INCOMPLETE", details: { steps: missing.pluck("step") })
      end

      # ─── Authorization helpers ───────────────────────────────────────────

      def authorize_update!
        return if current_user.manager_or_above?
        return if @work_order.assignee_id == current_user.id
        render_error("You can only update work orders assigned to you", :forbidden)
      end

      def authorize_assignee_or_manager!
        return if current_user.manager_or_above?
        return if @work_order.assignee_id == current_user.id
        render_error("Forbidden", :forbidden)
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
        scope = scope.where(vendor_id: params[:vendor_id]) if params[:vendor_id].present?
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

      # The client sends only { step, completed } per item. Merge that into the stored checklist so the
      # instructions and "required" flags are not lost, and note who did each step and when. Sending a
      # step that is already done again (a replay after a lost connection) changes nothing.
      def merge_checklist(incoming)
        updates = Array(incoming).index_by { |item| item[:step].to_i }
        Array(@work_order.checklist).map do |item|
          update = updates[item["step"].to_i]
          next item unless update

          done = ActiveModel::Type::Boolean.new.cast(update[:completed]) || false
          next item if done == (item["completed"] == true)

          if done
            item.merge("completed" => true, "completed_at" => Time.current.iso8601,
                                      "completed_by" => current_user.id, "completed_by_name" => current_user.full_name)
          else
            item.except("completed_at", "completed_by", "completed_by_name").merge("completed" => false)
          end
        end
      end

      def require_manager_for_vendor!
        sent = params[:work_order].respond_to?(:keys) && params[:work_order].keys.intersect?(VENDOR_FIELDS)
        return unless sent && !current_user.manager_or_above?

        render_error("Only a manager can give a work order to a vendor or enter what the vendor charged", :forbidden)
      end

      def work_order_params
        params.require(:work_order).permit(
          :title, :description, :priority, :asset_id, :assignee_id,
          :due_date, :estimated_hours, :actual_hours, :completion_notes,
          :rejection_reason, *VENDOR_FIELDS, checklist: [ :step, :completed ]
        )
      end
    end
  end
end
