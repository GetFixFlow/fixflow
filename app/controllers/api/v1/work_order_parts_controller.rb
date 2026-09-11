module Api
  module V1
    class WorkOrderPartsController < Api::V1::BaseController
      before_action :set_work_order

      # POST /api/v1/work_orders/:work_order_id/parts
      def create
        part = current_organization.parts.find(params[:part_id])
        qty  = (params[:quantity_used] || 1).to_i

        ActiveRecord::Base.transaction do
          part.adjust_stock(qty, direction: :remove)
          wop = @work_order.work_order_parts.create!(
            part:          part,
            quantity_used: qty,
            unit_cost:     params[:unit_cost]
          )
          render json: {
            data: {
              id:            wop.id,
              part_id:       part.id,
              name:          part.name,
              quantity_used: wop.quantity_used,
              unit_cost:     wop.unit_cost
            }
          }, status: :created
        end
      end

      # DELETE /api/v1/work_orders/:work_order_id/parts/:id
      def destroy
        wop = @work_order.work_order_parts.find(params[:id])
        ActiveRecord::Base.transaction do
          wop.part.adjust_stock(wop.quantity_used, direction: :add)
          wop.destroy!
        end
        head :no_content
      end

      private

      def set_work_order
        @work_order = current_organization.work_orders.find(params[:work_order_id])
      end
    end
  end
end
