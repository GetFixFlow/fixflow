module Api
  module V1
    class ApiKeysController < Api::V1::BaseController
      before_action :require_admin!
      before_action :set_api_key, only: :destroy

      # GET /api/v1/api_keys
      def index
        keys = current_organization.api_keys.active_keys.order(:name)
        render json: { api_keys: ApiKeyBlueprint.render_as_hash(keys) }
      end

      # POST /api/v1/api_keys
      def create
        raw_key, digest = ApiKey.generate

        key = current_organization.api_keys.create!(
          name:       params.require(:api_key).require(:name),
          key_digest: digest,
          scopes:     Array(params.dig(:api_key, :scopes)),
          expires_at: params.dig(:api_key, :expires_at)
        )

        # raw_key is returned exactly ONCE and never stored
        render json: ApiKeyBlueprint.render_as_hash(key).merge(key: raw_key), status: :created
      end

      # DELETE /api/v1/api_keys/:id  — revoke
      def destroy
        @api_key.update!(active: false)
        head :no_content
      end

      private

      def set_api_key
        @api_key = current_organization.api_keys.find(params[:id])
      end
    end
  end
end
