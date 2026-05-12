module Api
  module V1
    class PartsController < Api::V1::BaseController
      before_action :set_part, only: %i[show update destroy adjust_stock]

      def index
        scope = current_organization.parts
        pagy, parts = pagy(scope.order(:name))
        render json: {
          parts: PartBlueprint.render_as_hash(parts),
          meta: pagy_metadata_response(pagy)
        }
      end

      def low_stock
        parts = current_organization.parts.low_stock.order(:name)
        render json: { parts: PartBlueprint.render_as_hash(parts) }
      end

      def show
        render json: PartBlueprint.render_as_hash(@part)
      end

      def create
        part = current_organization.parts.create!(part_params)
        render json: PartBlueprint.render_as_hash(part), status: :created
      end

      def update
        @part.update!(part_params)
        render json: PartBlueprint.render_as_hash(@part)
      end

      def destroy
        @part.destroy!
        head :no_content
      end

      def adjust_stock
        direction = params[:direction]&.to_sym || :add
        @part.adjust_stock(params[:quantity].to_f, direction: direction)
        render json: PartBlueprint.render_as_hash(@part.reload)
      rescue ArgumentError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      private

      def set_part
        @part = current_organization.parts.find(params[:id])
      end

      def part_params
        params.require(:part).permit(:name, :sku, :quantity_on_hand, :reorder_point, :unit, :location_id)
      end
    end
  end
end
