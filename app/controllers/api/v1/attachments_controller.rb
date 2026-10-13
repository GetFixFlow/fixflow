module Api
  module V1
    class AttachmentsController < Api::V1::BaseController
      before_action :set_work_order
      before_action :set_attachment, only: %i[destroy]

      # GET /api/v1/work_orders/:work_order_id/attachments
      def index
        render json: { attachments: AttachmentBlueprint.render_as_hash(@work_order.attachments.includes(:user)) }
      end

      # POST /api/v1/work_orders/:work_order_id/attachments  (multipart: file, description, client_id)
      # `client_id` is optional: a phone that lost signal sends the same one again, and gets the
      # attachment it already uploaded instead of a second copy.
      def create
        file = params.dig(:attachment, :file) || params[:file]
        unless file.respond_to?(:original_filename)
          return render_error("Choose a file to upload.", :unprocessable_entity,
code: "VALIDATION_ERROR")
        end

        if file.content_type.to_s.start_with?("image/") && !Attachment.photo?(file.tempfile)
          return render_error("That file is not a valid photo.", :unprocessable_entity, code: "VALIDATION_ERROR")
        end

        client_id = params[:client_id].presence
        existing = client_id && @work_order.attachments.find_by(client_id: client_id, user_id: current_user.id)
        return render json: { data: AttachmentBlueprint.render_as_hash(existing) } if existing

        attachment = @work_order.attachments.build(description: params[:description], user: current_user, client_id: client_id)
        attachment.file.attach(file)
        attachment.save!
        render json: { data: AttachmentBlueprint.render_as_hash(attachment) }, status: :created
      rescue ActiveRecord::RecordNotUnique
        render json: { data: AttachmentBlueprint.render_as_hash(@work_order.attachments.find_by!(client_id: client_id)) }
      end

      # DELETE /api/v1/work_orders/:work_order_id/attachments/:id
      def destroy
        unless @attachment.user_id == current_user.id || current_user.manager_or_above?
          return render_error("Forbidden", :forbidden)
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
