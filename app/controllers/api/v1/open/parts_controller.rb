module Api
  module V1
    module Open
      class PartsController < BaseController
        def index
          scope = since(organization.parts.includes(:location), :updated_at, :updated_since)
          scope = scope.low_stock if params[:low_stock] == "true"
          if params[:q].present?
            scope = scope.where("name ILIKE :q OR sku ILIKE :q",
q: "%#{Part.sanitize_sql_like(params[:q].to_s.strip)}%")
          end
          render_list(sorted(scope), ::PublicApi::PartBlueprint)
        end

        def show
          render_data(::PublicApi::PartBlueprint.render_as_hash(organization.parts.find(params[:id])))
        end
      end
    end
  end
end
