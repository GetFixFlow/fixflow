module Api
  module V1
    module Open
      class AssetsController < BaseController
        def index
          scope = since(organization.assets.kept.includes(:location), :updated_at, :updated_since)
          scope = scope.by_status(params[:status]) if params[:status].present?
          scope = scope.by_location(params[:location_id]) if params[:location_id].present?
          scope = scope.search_by_name_or_tag(params[:q]) if params[:q].present?
          render_list(sorted(scope), ::PublicApi::AssetBlueprint)
        end

        def show
          render_data(::PublicApi::AssetBlueprint.render_as_hash(find_asset))
        end

        def create
          asset = organization.assets.create!(asset_params)
          render_data(::PublicApi::AssetBlueprint.render_as_hash(asset), status: :created)
        end

        def update
          asset = find_asset
          asset.update!(asset_params)
          render_data(::PublicApi::AssetBlueprint.render_as_hash(asset))
        end

        private

        def find_asset = organization.assets.kept.find(params[:id])

        def asset_params
          params.expect(asset: [:name, :asset_tag, :serial_number, :status, :barcode, :location_id, :warranty_expires_on,
                                { custom_fields: {} }])
        end
      end
    end
  end
end
