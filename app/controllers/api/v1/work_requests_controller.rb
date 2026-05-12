module Api
  module V1
    # Public (unauthenticated) work request portal.
    # Staff submit maintenance requests without needing a FixFlow account.
    class WorkRequestsController < Api::V1::BaseController
      skip_before_action :authenticate_user!

      # POST /api/v1/requests
      def create
        org = Organization.find_by(subdomain: params[:subdomain])
        return render_error("Organization not found", status: :not_found) unless org

        work_order = org.work_orders.create!(
          title:           params[:title],
          description:     params[:description],
          priority:        "medium",
          requester_name:  params[:requester_name],
          requester_email: params[:requester_email],
          asset_id:        params[:asset_id],
          public_token:    SecureRandom.urlsafe_base64(16)
        )

        NotifyNewRequestJob.perform_later(work_order.id)

        render json: {
          message: "Work request submitted successfully",
          token:   work_order.public_token,
          id:      work_order.id
        }, status: :created
      end

      # GET /api/v1/requests/:token
      def show
        work_order = WorkOrder.find_by!(public_token: params[:token])
        render json: {
          work_order_number: work_order.work_order_number,
          title:             work_order.title,
          status:            work_order.status,
          priority:          work_order.priority,
          created_at:        work_order.created_at,
          updated_at:        work_order.updated_at
        }
      end
    end
  end
end
