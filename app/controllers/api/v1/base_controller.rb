module Api
  module V1
    class BaseController < ApplicationController
      include Authorizable
      include Pundit::Authorization

      before_action :authenticate_user!
      before_action :set_current_context

      # ── Error handling ────────────────────────────────────────────────────

      rescue_from ActiveRecord::RecordNotFound do |e|
        render_error("Resource not found", :not_found, code: "RESOURCE_NOT_FOUND")
      end

      rescue_from ActiveRecord::RecordInvalid do |e|
        render_error(e.record.errors.full_messages.first,
                     :unprocessable_entity,
                     code: "VALIDATION_ERROR",
                     details: e.record.errors.as_json)
      end

      rescue_from ActionController::ParameterMissing do |e|
        render_error("Missing parameter: #{e.param}", :bad_request, code: "MISSING_PARAMETER")
      end

      rescue_from AASM::InvalidTransition do |e|
        render_error("Invalid status transition: #{e.message}",
                     :unprocessable_entity, code: "INVALID_TRANSITION")
      end

      rescue_from Pundit::NotAuthorizedError do |e|
        render_error("You are not authorized to perform this action",
                     :forbidden, code: "FORBIDDEN")
      end

      rescue_from ActsAsTenant::Errors::NoTenantSet do |e|
        render_error("Organization context required", :unauthorized, code: "NO_TENANT")
      end

      rescue_from ActionController::BadRequest do |e|
        render_error(e.message, :bad_request, code: "BAD_REQUEST")
      end

      rescue_from StandardError do |e|
        Rails.logger.error "Unhandled error: #{e.class} — #{e.message}"
        Rails.logger.error e.backtrace.first(10).join("\n")
        render_error("An unexpected error occurred",
                     :internal_server_error, code: "INTERNAL_ERROR")
      end

      private

      def set_current_context
        Current.user       = current_user
        Current.request_ip = request.remote_ip
        ActsAsTenant.current_tenant = current_organization
      end

      def current_organization
        current_user&.organization
      end

      # ── Response helpers ─────────────────────────────────────────────────

      def render_success(data, status: :ok)
        render json: {
          success: true,
          data:    data,
          meta:    response_meta
        }, status: status
      end

      def render_error(message, status, code: "ERROR", details: nil)
        payload = {
          success: false,
          error:   { code: code, message: message },
          meta:    response_meta
        }
        payload[:error][:details] = details if details
        render json: payload, status: status
      end

      def render_paginated(records, blueprint, key:, view: nil)
        pagy, items = pagy(records)
        render json: {
          success: true,
          key =>   blueprint.render_as_hash(items, **(view ? { view: view } : {})),
          meta:    response_meta.merge(pagination: pagy_metadata_response(pagy))
        }
      end

      def response_meta
        { request_id: @request_id, timestamp: Time.current.iso8601 }
      end

      def pagy_metadata_response(pagy)
        {
          current_page: pagy.page,
          total_pages:  pagy.pages,
          total_count:  pagy.count,
          per_page:     pagy.limit
        }
      end

      # ── Lograge payload ──────────────────────────────────────────────────

      def append_info_to_payload(payload)
        super
        payload[:request_id]      = @request_id
        payload[:user_id]         = current_user&.id
        payload[:organization_id] = current_organization&.id
      end
    end
  end
end
