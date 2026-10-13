module Api
  module V1
    class PartsController < Api::V1::BaseController
      before_action :set_part, only: %i[show update destroy adjust_stock]
      before_action :authorize_part

      rescue_from Part::InsufficientStock do |error|
        render_error(error.message, :unprocessable_entity, code: "INSUFFICIENT_STOCK")
      end

      def index
        scope = current_organization.parts
        scope = search(scope, params[:search]) if params[:search].present?
        scope = scope.low_stock if ActiveModel::Type::Boolean.new.cast(params[:low_stock])
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
        record(part, "part.created")
        render json: PartBlueprint.render_as_hash(part), status: :created
      end

      # The stock level is not edited here: use adjust_stock, which keeps a record of who changed it.
      def update
        @part.update!(part_params)
        record(@part, "part.updated", changes: @part.previous_changes.except("updated_at"))
        render json: PartBlueprint.render_as_hash(@part)
      end

      def destroy
        return render_error(@part.errors.full_messages.first, :unprocessable_entity, code: "PART_IN_USE") unless @part.destroy

        record(@part, "part.deleted")
        head :no_content
      end

      # PATCH /api/v1/parts/:id/adjust_stock  { quantity, direction: add|remove, reason }
      def adjust_stock
        quantity = params[:quantity].to_f
        unless quantity.positive?
          return render_error("Enter a quantity greater than zero.", :unprocessable_entity,
code: "VALIDATION_ERROR")
        end

        before = @part.quantity_on_hand
        direction = params[:direction].to_s == "remove" ? :remove : :add
        @part.adjust_stock(quantity, direction: direction)
        record(@part, "part.stock_adjusted", from: before.to_f, to: @part.quantity_on_hand.to_f, reason: params[:reason].presence)
        render json: PartBlueprint.render_as_hash(@part)
      end

      private

      # By name or SKU, ignoring case.
      def search(scope, text)
        pattern = "%#{Part.sanitize_sql_like(text)}%"
        scope.where("name ILIKE :q OR sku ILIKE :q", q: pattern)
      end

      def set_part
        @part = current_organization.parts.find(params[:id])
      end

      # PartPolicy: technicians read and take stock, managers create and edit, admins delete.
      def authorize_part
        authorize(@part || Part)
      end

      def part_params
        allowed = %i[name sku reorder_point unit unit_cost location_id]
        allowed << :quantity_on_hand if action_name == "create"
        params.expect(part: allowed)
      end

      def record(part, action, **metadata)
        ActivityLogService.log(action: action, resource: part, metadata: metadata.compact)
      end
    end
  end
end
