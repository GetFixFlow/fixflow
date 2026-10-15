module Api
  module V1
    # Public (no account) work request portal: scan an asset's QR label, report the problem, follow it
    # with a link. Anyone on the internet can call this, so it only ever creates a request or shows
    # the one request whose unguessable token was given. See PublicWorkRequest and the throttles in
    # config/initializers/rack_attack.rb.
    class WorkRequestsController < Api::V1::BaseController
      skip_before_action :authenticate_user!
      skip_before_action :set_current_context

      MAX_BODY = 16.kilobytes

      before_action { use_secure_headers_override(:no_referrer) }
      before_action :limit_body_size, only: :create
      before_action :load_company
      around_action :within_company
      after_action  :keep_private

      # POST /api/v1/work_requests  { work_request: { requester_name, requester_email, description, ... } }
      def create
        return render_pretend_success if bot?

        form = PublicWorkRequest.new(@company, request_params.except(:leave_empty))
        work_order = form.save
        return render_invalid(form) unless work_order

        render json: { data: PublicWorkRequest.status_view(work_order), token: work_order.public_token },
               status: :created
      end

      # GET /api/v1/work_requests/:token
      # A token that matches nothing gets the same answer as one that never existed.
      def show
        work_order = WorkOrder.find_by!(public_token: params[:token].to_s)
        render json: { data: PublicWorkRequest.status_view(work_order) }
      end

      # GET /api/v1/public_assets/:code  what the form says it is reporting on, for someone who scanned a label.
      def asset
        asset = @company.assets.kept.includes(:location).find_by!(public_code: params[:code].to_s)
        render json: { data: { name: asset.name, asset_tag: asset.asset_tag, location: asset.location&.name } }
      end

      private

      def request_params
        params.expect(work_request: %i[requester_name requester_email description location_description
                                       asset_description asset_code leave_empty])
      end

      # A form field no person sees (it is hidden): only a script fills it in.
      def bot?
        request_params[:leave_empty].present?
      end

      # The script is told it worked, so it has nothing to learn from; nothing is created.
      def render_pretend_success
        render json: { data: { token: SecureRandom.urlsafe_base64(PublicWorkRequest::TOKEN_BYTES) } }, status: :created
      end

      def render_invalid(form)
        render_error(form.errors.full_messages.first, :unprocessable_entity,
                     code: "VALIDATION_ERROR", details: form.errors.as_json)
      end

      # A real request is a few hundred bytes. The proxy in front also caps the body (nginx.conf).
      def limit_body_size
        return if request.content_length.to_i <= MAX_BODY

        render_error("The request is too large", :content_too_large, code: "PAYLOAD_TOO_LARGE")
      end

      # One company per install; before setup there is nothing to report on.
      def load_company
        @company = Organization.the_company
        render_error("Not found", :not_found, code: "RESOURCE_NOT_FOUND") unless @company
      end

      def within_company(&)
        ActsAsTenant.with_tenant(@company, &)
      end

      # The link is the only secret: keep it out of caches and search engines (and, through the
      # no_referrer override above, out of the Referer header).
      def keep_private
        response.set_header("Cache-Control", "no-store")
        response.set_header("X-Robots-Tag", "noindex, nofollow")
      end
    end
  end
end
