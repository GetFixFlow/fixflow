module Api
  module V1
    class CommentsController < Api::V1::BaseController
      before_action :set_work_order
      before_action :set_comment, only: %i[destroy]

      # GET /api/v1/work_orders/:work_order_id/comments
      def index
        comments = @work_order.comments.includes(:user).order(created_at: :asc)
        comments = comments.where(internal: false) unless current_user.manager_or_above?
        render json: { comments: CommentBlueprint.render_as_hash(comments) }
      end

      # POST /api/v1/work_orders/:work_order_id/comments
      # `client_id` is optional: a phone that lost signal sends the same one again, and gets the
      # comment it already posted instead of a second copy.
      def create
        attrs = comment_params
        if attrs[:internal] && !current_user.manager_or_above?
          return render_error("Only managers can add internal notes.", :forbidden, code: "FORBIDDEN")
        end

        existing = attrs[:client_id].present? && @work_order.comments.find_by(client_id: attrs[:client_id], user_id: current_user.id)
        return render json: { data: CommentBlueprint.render_as_hash(existing) } if existing

        comment = @work_order.comments.create!(attrs.merge(user: current_user))
        render json: { data: CommentBlueprint.render_as_hash(comment) }, status: :created
      rescue ActiveRecord::RecordNotUnique
        render json: { data: CommentBlueprint.render_as_hash(@work_order.comments.find_by!(client_id: attrs[:client_id])) }
      end

      # DELETE /api/v1/work_orders/:work_order_id/comments/:id
      def destroy
        unless @comment.user_id == current_user.id || current_user.manager_or_above?
          return render_error("Forbidden", :forbidden)
        end
        @comment.destroy!
        head :no_content
      end

      private

      def set_work_order
        @work_order = current_organization.work_orders.find(params[:work_order_id])
      end

      def set_comment
        @comment = @work_order.comments.find(params[:id])
      end

      def comment_params
        params.require(:comment).permit(:body, :internal, :client_id)
      end
    end
  end
end
