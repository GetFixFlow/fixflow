module Api
  module V1
    class AttachmentsController < Api::V1::BaseController
      before_action :set_work_order
      before_action :set_attachment, only: %i[destroy]

      # GET /api/v1/work_orders/:work_order_id/attachments
      def index
        render json: { attachments: AttachmentBlueprint.render_as_hash(@work_order.attachments.includes(:user)) }
      end

      # POST /api/v1/work_orders/:work_order_id/attachments
      def create
        attachment = @work_order.attachments.build(description: params[:description], user: current_user)
        attachment.file.attach(params[:file])
        attachment.save!
        render json: AttachmentBlueprint.render_as_hash(attachment), status: :created
      end

      # DELETE /api/v1/work_orders/:work_order_id/attachments/:id
      def destroy
        unless @attachment.user_id == current_user.id || current_user.manager_or_above?
          return render_error("Forbidden", status: :forbidden)
        end
        @attachment.destroy!
        head :no_content
      end

      private

      def set_work_order
        @work_order = current_organization.work_orders.find(params[:work_order_id])
      end

      def set_attachment
        @attachment = @work_order.attachments.find(params[:id])
      end
    end
  end
end
