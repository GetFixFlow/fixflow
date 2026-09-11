module Api
  module V1
    class AssetsController < Api::V1::BaseController
      before_action :require_manager!, only: %i[create update]
      before_action :require_admin!,   only: %i[destroy]
      before_action :set_asset,              only: %i[show update work_orders sensor_readings iot_rules qr_code]
      before_action :set_asset_with_history, only: %i[history]

      # GET /api/v1/assets
      def index
        scope = current_organization.assets
        scope = scope.by_status(params[:status])             if params[:status].present?
        scope = scope.by_location(params[:location_id])      if params[:location_id].present?
        scope = scope.search_by_name_or_tag(params[:search]) if params[:search].present?
        pagy, assets = pagy(scope.order(:name))
        render json: {
          assets: AssetBlueprint.render_as_hash(assets),
          meta:   pagy_metadata_response(pagy)
        }
      end

      # GET /api/v1/assets/:id
      def show
        render json: { data: AssetBlueprint.render_as_hash(@asset, view: :extended) }
      end

      # POST /api/v1/assets
      def create
        asset = current_organization.assets.create!(asset_params)
        render json: { data: AssetBlueprint.render_as_hash(asset) }, status: :created
      end

      # PATCH /api/v1/assets/:id
      def update
        @asset.update!(asset_params)
        render json: { data: AssetBlueprint.render_as_hash(@asset) }
      end

      # DELETE /api/v1/assets/:id — soft delete
      def destroy
        @asset.discard!
        head :no_content
      end

      # GET /api/v1/assets/:id/history — maintenance history (available even for discarded assets)
      def history
        pagy, work_orders = pagy(@asset.work_orders.order(created_at: :desc))
        render json: {
          work_orders: WorkOrderBlueprint.render_as_hash(work_orders),
          meta:        pagy_metadata_response(pagy)
        }
      end

      # POST /api/v1/assets/:id/qr_code
      def qr_code
        payload = "fixflow://assets/#{@asset.id}/#{@asset.asset_tag}"
        png = RQRCode::QRCode.new(payload).as_png(size: 300)
        send_data png.to_s, type: "image/png", disposition: "inline", filename: "#{@asset.asset_tag}.png"
      end

      # GET /api/v1/assets/:id/work_orders
      def work_orders
        pagy, work_orders = pagy(@asset.work_orders.order(created_at: :desc))
        render json: {
          work_orders: WorkOrderBlueprint.render_as_hash(work_orders),
          meta:        pagy_metadata_response(pagy)
        }
      end

      # GET /api/v1/assets/:id/sensor_readings
      def sensor_readings
        readings = @asset.sensor_readings.since(24.hours.ago).recent.limit(500)
        render json: { sensor_readings: SensorReadingBlueprint.render_as_hash(readings) }
      end

      # GET /api/v1/assets/:id/iot_rules
      def iot_rules
        render json: { iot_rules: IotRuleBlueprint.render_as_hash(@asset.iot_rules) }
      end

      private

      def set_asset
        @asset = current_organization.assets.find(params[:id])
      end

      # History is available even for soft-deleted assets.
      def set_asset_with_history
        @asset = current_organization.assets.with_discarded.find(params[:id])
      end

      def asset_params
        params.require(:asset).permit(:name, :asset_tag, :serial_number, :status,
          :location_id, custom_fields: {})
      end
    end
  end
end
