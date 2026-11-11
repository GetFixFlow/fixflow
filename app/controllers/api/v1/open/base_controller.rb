module Api
  module V1
    module Open
      # The public API: what a company's other programs (n8n, Zapier, a script, an ERP) use, signed in with an API key instead
      # of a person's account. Everything it answers is `{ "data": ... }` and a list also has `meta`; errors have the same
      # shape as the rest of the API. A key's scopes decide what it may do (read: GET; write: everything here), and it
      # sees only its own company.
      #
      # The key is sent as `Authorization: Bearer fxk_...` or `X-API-Key: fxk_...`, never in the address (an address ends
      # up in logs).
      class BaseController < ActionController::API
        include Pagy::Backend

        MAX_PER_PAGE = 100
        DEFAULT_PER_PAGE = 25
        SORTS = %w[created_at updated_at id].freeze

        before_action :set_request_id
        before_action :authenticate_key!
        before_action :require_scope_for_request!
        around_action :in_the_keys_company

        rescue_from(StandardError) do |e|
          Rails.logger.error "[PublicApi] #{e.class}: #{e.message}\n#{e.backtrace.first(8).join("\n")}"
          render_error("An unexpected error occurred", :internal_server_error, code: "INTERNAL_ERROR")
        end
        rescue_from(ActiveRecord::RecordNotFound) { render_error("Resource not found", :not_found, code: "RESOURCE_NOT_FOUND") }
        rescue_from(ActiveRecord::RecordInvalid) do |e|
          render_error(e.record.errors.full_messages.first, :unprocessable_entity, code: "VALIDATION_ERROR",
details: e.record.errors.as_json)
        end
        rescue_from(ActionController::ParameterMissing) { |e| render_error("Missing parameter: #{e.param}", :bad_request, code: "MISSING_PARAMETER") }
        rescue_from(ActionController::BadRequest) { |e| render_error(e.message, :bad_request, code: "BAD_REQUEST") }

        private

        attr_reader :api_key

        def set_request_id
          @request_id = request.headers["X-Request-ID"].presence || SecureRandom.uuid
          response.set_header("X-Request-ID", @request_id)
        end

        def authenticate_key!
          if params.key?(:api_key) || params.key?(:key)
            return render_error("Send the key in the Authorization header, not in the address", :bad_request, code: "KEY_IN_ADDRESS")
          end

          @api_key = ApiKey.authenticate(raw_key)
          return render_unauthorized unless @api_key

          touch_key
        end

        def raw_key
          bearer = request.headers["Authorization"].to_s[/\ABearer\s+(\S+)\z/i, 1]
          bearer.to_s.start_with?(ApiKey::KEY_PREFIX) ? bearer : request.headers["X-API-Key"].to_s
        end

        def render_unauthorized
          response.set_header("WWW-Authenticate", 'Bearer realm="FixFlow"')
          render_error("The API key is missing, wrong, revoked or expired", :unauthorized, code: "INVALID_API_KEY")
        end

        # Reading needs read (or write); anything else needs write. Decided by the request's method so a new action cannot
        # forget to ask.
        def require_scope_for_request!
          needed = request.get? || request.head? ? :read : :write
          return if api_key.scope?(needed)

          render_error("This key may not #{needed == :read ? 'read' : 'change'} data (it has: #{api_key.effective_scopes.join(', ')})",
                       :forbidden, code: "INSUFFICIENT_SCOPE")
        end

        def in_the_keys_company(&)
          Current.set(api_key_name: "#{api_key.name} (key #{api_key.id})", request_ip: request.remote_ip) do
            ActsAsTenant.with_tenant(api_key.organization) do
              Time.use_zone(api_key.organization.timezone_or_default || "UTC", &)
            end
          end
        end

        def organization = api_key.organization

        # A key used all day would write to its row on every request: once a minute is enough to see that it is in use.
        def touch_key
          api_key.touch_last_used if api_key.last_used_at.nil? || api_key.last_used_at < 1.minute.ago
        end

        # ── Answers ──

        def render_data(data, status: :ok) = render(json: { data: data }, status: status)

        def render_list(scope, blueprint, view: nil)
          pagy, records = pagy(scope, limit: per_page, page: params[:page])
          options = view ? { view: view } : {}
          render json: { data: blueprint.render_as_hash(records, **options),
                         meta: { page: pagy.page, per_page: pagy.limit, total_count: pagy.count, total_pages: pagy.pages } }
        end

        def per_page = params[:per_page].to_i.clamp(1, MAX_PER_PAGE).then { |n| params[:per_page].present? ? n : DEFAULT_PER_PAGE }

        def render_error(message, status, code: "ERROR", details: nil)
          error = { code: code, message: message }
          error[:details] = details if details
          render json: { success: false, error: error, meta: { request_id: @request_id, timestamp: Time.current.iso8601 } },
status: status
        end

        # ── Filters shared by the lists ──

        # `sort=updated_at` or `sort=-updated_at` (newest first); polling programs ask for `updated_since` and oldest first.
        def sorted(scope)
          sort = params[:sort].to_s
          column = sort.delete_prefix("-")
          return scope.order(id: :desc) unless SORTS.include?(column)

          scope.order(column => sort.start_with?("-") ? :desc : :asc, :id => :asc)
        end

        def since(scope, column, param)
          raw = params[param]
          return scope if raw.blank?

          time = Time.zone.parse(raw.to_s)
          raise ActionController::BadRequest, "#{param} must be a date and time, like 2026-11-01T09:00:00Z" unless time

          scope.where(scope.arel_table[column].gteq(time))
        end
      end
    end
  end
end
