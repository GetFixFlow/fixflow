module Api
  module V1
    # Parts used on a work order. Logging one takes it out of stock and adds its cost to the
    # work order; removing it puts the stock back.
    class WorkOrderPartsController < Api::V1::BaseController
      before_action :set_work_order
      before_action :require_manager_or_assignee!, only: %i[create destroy]
      before_action :require_open_work_order!,     only: %i[create destroy]

      rescue_from Part::InsufficientStock do |error|
        render_error(error.message, :unprocessable_entity, code: "INSUFFICIENT_STOCK")
      end

      # GET /api/v1/work_orders/:work_order_id/parts
      def index
        render json: { parts: WorkOrderPartBlueprint.render_as_hash(lines) }
      end

      # POST /api/v1/work_orders/:work_order_id/parts  { part: { part_id, quantity_used, unit_cost } }
      def create
        attrs = params.expect(part: %i[part_id quantity_used unit_cost])
        part  = current_organization.parts.find(attrs[:part_id])
        line  = nil

        ActiveRecord::Base.transaction do
          quantity = attrs[:quantity_used].presence&.to_i || 1
          part.adjust_stock(quantity, direction: :remove) if quantity.positive?
          line = @work_order.work_order_parts.create!(part: part, quantity_used: quantity,
                                                      unit_cost: attrs[:unit_cost].presence || part.unit_cost)
          @work_order.recalculate_parts_cost!
        end

        render json: { data: WorkOrderPartBlueprint.render_as_hash(line) }, status: :created
      end

      # DELETE /api/v1/work_orders/:work_order_id/parts/:id
      def destroy
        line = @work_order.work_order_parts.find(params[:id])
        ActiveRecord::Base.transaction do
          line.part.adjust_stock(line.quantity_used, direction: :add)
          line.destroy!
          @work_order.recalculate_parts_cost!
        end
        head :no_content
      end

      private

      def set_work_order
        @work_order = current_organization.work_orders.find(params[:work_order_id])
      end

      def lines
        @work_order.work_order_parts.includes(:part).order(:id)
      end

      # Whoever may update the work order may log parts on it.
      def require_manager_or_assignee!
        return if current_user.manager_or_above? || @work_order.assignee_id == current_user.id

        render_error("You can only log parts on work orders assigned to you", :forbidden, code: "FORBIDDEN")
      end

      def require_open_work_order!
        return unless @work_order.status.in?(%w[verified cancelled])

        render_error("Parts cannot be changed on a #{@work_order.status} work order", :unprocessable_entity,
                     code: "WORK_ORDER_CLOSED")
      end
    end
  end
end
