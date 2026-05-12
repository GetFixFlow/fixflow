module Api
  module V1
    class BaseController < ApplicationController
      include Authorizable

      before_action :authenticate_user!

      rescue_from ActiveRecord::RecordNotFound,    with: :render_not_found
      rescue_from ActiveRecord::RecordInvalid,     with: :render_record_invalid
      rescue_from ActionController::ParameterMissing, with: :render_bad_request

      private

      def current_organization
        current_user&.organization
      end

      def render_success(data, status: :ok)
        render json: data, status: status
      end

      def render_error(message, status:)
        render json: { error: message }, status: status
      end

      def render_paginated(records, blueprint, key:, view: nil)
        pagy, items = pagy(records)
        render json: {
          key => blueprint.render_as_hash(items, **(view ? { view: view } : {})),
          meta: pagy_metadata_response(pagy)
        }
      end

      def pagy_metadata_response(pagy)
        {
          current_page: pagy.page,
          total_pages:  pagy.pages,
          total_count:  pagy.count,
          per_page:     pagy.limit
        }
      end

      def render_not_found(exception)
        render_error(exception.message, status: :not_found)
      end

      def render_record_invalid(exception)
        render json: { errors: exception.record.errors.full_messages }, status: :unprocessable_entity
      end

      def render_bad_request(exception)
        render_error(exception.message, status: :bad_request)
      end
    end
  end
end
