module Api
  module V1
    module Open
      # GET /api/v1/open/openapi: the public API described for tools (OpenAPI 3). Needs no key: it says nothing about any company.
      class OpenapiController < BaseController
        skip_before_action :authenticate_key!
        skip_before_action :require_scope_for_request!
        skip_around_action :in_the_keys_company

        def show
          render json: PublicApiSpec.document(server: "#{Directory.api_url}/api/v1/open")
        end
      end
    end
  end
end
