module Api
  module V1
    # The meters of an asset: running hours, kilometres, cycles. Managers add and change them; their readings are in
    # MeterReadingsController.
    class MetersController < Api::V1::BaseController
      before_action :set_asset, only: %i[index create]
      before_action :set_meter, only: %i[update destroy]
      before_action :authorize_meter

      # GET /api/v1/assets/:asset_id/meters
      def index
        render json: { meters: MeterBlueprint.render_as_hash(@asset.meters.order(:name)) }
      end

      # POST /api/v1/assets/:asset_id/meters  { meter: { name, unit, sensor_metric, reading } }
      # reading is where the meter stands today (a machine with 4,120 hours on it starts at 4,120).
      def create
        meter = @asset.meters.new(meter_params.merge(organization: current_organization))
        started = meter.reading.to_d.positive?
        meter.last_reading_at = Time.current if started
        Meter.transaction do
          meter.save!
          record_starting_reading(meter) if started
        end
        render json: { data: MeterBlueprint.render_as_hash(meter) }, status: :created
      end

      # PATCH /api/v1/meters/:id  { meter: { name, unit, sensor_metric } }: the reading itself is changed by recording one.
      def update
        @meter.update!(meter_params(:name, :unit, :sensor_metric))
        render json: { data: MeterBlueprint.render_as_hash(@meter) }
      end

      # DELETE /api/v1/meters/:id (refused while a maintenance schedule follows it)
      def destroy
        unless @meter.destroy
          return render_error("A maintenance schedule follows this meter. Change or delete the schedule first.",
                              :unprocessable_entity, code: "METER_IN_USE")
        end

        head :no_content
      end

      private

      def record_starting_reading(meter)
        meter.readings.create!(value: meter.reading, recorded_at: meter.last_reading_at, recorded_by: current_user,
                               note: "Starting reading")
      end

      def set_asset
        @asset = current_organization.assets.kept.find(params[:asset_id])
      end

      def set_meter
        @meter = current_organization.meters.find(params[:id])
      end

      def authorize_meter
        authorize(@meter || Meter)
      end

      def meter_params(*allowed)
        allowed = %i[name unit sensor_metric reading] if allowed.empty?
        params.expect(meter: allowed)
      end
    end
  end
end
