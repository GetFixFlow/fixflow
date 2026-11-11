module Api
  module V1
    module Open
      class LocationsController < BaseController
        def index
          scope = since(organization.locations, :updated_at, :updated_since)
          render_list(sorted(scope), ::PublicApi::LocationBlueprint)
        end

        def show
          render_data(::PublicApi::LocationBlueprint.render_as_hash(organization.locations.find(params[:id])))
        end
      end
    end
  end
end
