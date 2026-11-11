module Api
  module V1
    module Open
      class WorkOrdersController < BaseController
        # What a program may do to a work order's lifecycle. Verifying and rejecting are decisions for a person.
        EVENTS = %w[assign start hold need_parts resume complete cancel].freeze

        def index
          scope = since(organization.work_orders.includes(:asset, :assignee, :requester), :updated_at, :updated_since)
          scope = since(scope, :created_at, :created_since)
          scope = scope.by_status(params[:status].to_s.split(",")) if params[:status].present?
          scope = scope.by_priority(params[:priority].to_s.split(",")) if params[:priority].present?
          scope = scope.by_asset(params[:asset_id]) if params[:asset_id].present?
          scope = scope.by_assignee(params[:assignee_id]) if params[:assignee_id].present?
          scope = scope.search_by_keyword(params[:q].to_s.strip) if params[:q].present?
          render_list(sorted(scope), ::PublicApi::WorkOrderBlueprint)
        end

        def show
          render_data(present(find_work_order))
        end

        # POST /api/v1/open/work_orders { work_order: { title, description, priority, due_date, asset_id, ... } }
        def create
          attrs = work_order_params
          attrs[:priority] = organization.default_priority if attrs[:priority].blank?
          attrs[:due_date] = organization.default_due_days.days.from_now if attrs[:due_date].blank?
          # No person made it: the requester is the program (or what it says, when it is passing on someone's request).
          requester = { requester_name: params.dig(:work_order, :requester_name).presence || api_key.name,
                        requester_email: params.dig(:work_order, :requester_email).presence }
          work_order = organization.work_orders.new(attrs.merge(requester))
          work_order.require_custom_values = true
          work_order.save!
          render_data(present(work_order), status: :created)
        end

        def update
          work_order = find_work_order
          attrs = work_order_params
          work_order.require_custom_values = attrs.key?(:custom_values)
          work_order.update!(attrs)
          render_data(present(work_order))
        end

        # POST /api/v1/open/work_orders/:id/transitions { event: "complete", completion_notes: "...", actual_hours: 1.5 }
        def transitions
          work_order = find_work_order
          event = params[:event].to_s
          unless EVENTS.include?(event)
            return render_error("event must be one of #{EVENTS.join(', ')}", :unprocessable_entity,
code: "INVALID_TRANSITION")
          end

          work_order.assignee_id = params[:assignee_id] if event == "assign" && params[:assignee_id].present?
          work_order.completion_notes = params[:completion_notes] if params.key?(:completion_notes)
          work_order.actual_hours = params[:actual_hours] if params.key?(:actual_hours)
          work_order.cancellation_reason = params[:cancellation_reason] if event == "cancel"
          fire(work_order, event)
        end

        private

        def find_work_order = organization.work_orders.includes(:asset, :assignee, :requester).find(params[:id])

        def present(work_order) = ::PublicApi::WorkOrderBlueprint.render_as_hash(work_order)

        def work_order_params
          params.expect(work_order: [:title, :description, :priority, :asset_id, :assignee_id, :due_date, :estimated_hours,
                                     { custom_values: {} }])
        end

        def fire(work_order, event)
          if event == "complete" && work_order.incomplete_required_steps.any?
            return render_error("Complete the required checklist steps first", :unprocessable_entity, code: "CHECKLIST_INCOMPLETE",
details: { steps: work_order.incomplete_required_steps.pluck("step") })
          end

          if %w[start complete].include?(event) && work_order.approval_needed?
            work_order.request_approval!
            return render_error("A manager has to approve this work order in FixFlow first: it costs more than the company's " \
                                "approval limit. The managers have been asked.", :unprocessable_entity, code: "APPROVAL_REQUIRED")
          end
          if event == "assign" && work_order.assignee_id.blank?
            return render_error("assignee_id is needed to assign a work order", :unprocessable_entity, code: "VALIDATION_ERROR")
          end
          unless work_order.public_send(:"may_#{event}?")
            return render_error("Cannot #{event.tr('_', ' ')} a work order with status '#{work_order.status}'", :unprocessable_entity,
code: "INVALID_TRANSITION")
          end

          work_order.public_send(:"#{event}!")
          render_data(present(work_order))
        end
      end
    end
  end
end
