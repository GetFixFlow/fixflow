module Api
  module V1
    # The readings of a meter. Anyone who works on the equipment can take one; a reset (the meter was replaced) is a
    # manager's call. The reading is always taken now: a reading is not backdated.
    class MeterReadingsController < Api::V1::BaseController
      before_action :set_meter

      rescue_from MeterReadingRecorder::Rejected do |error|
        render_error(error.message, :unprocessable_entity, code: "METER_READING_REFUSED")
      end

      # GET /api/v1/meters/:meter_id/readings
      def index
        authorize(@meter, :show?)
        pagy, readings = pagy(@meter.readings.recent.includes(:recorded_by))
        render json: { readings: MeterReadingBlueprint.render_as_hash(readings), meta: pagy_metadata_response(pagy) }
      end

      # POST /api/v1/meters/:meter_id/readings  { reading: { value, note, reset } }
      def create
        attrs = params.expect(reading: %i[value note reset])
        reset = ActiveModel::Type::Boolean.new.cast(attrs[:reset]) == true
        authorize(@meter, reset ? :reset? : :record_reading?)

        reading = MeterReadingRecorder.call(@meter, value: attrs[:value], by: current_user, note: attrs[:note], reset: reset)
        render json: { data: MeterReadingBlueprint.render_as_hash(reading), meter: MeterBlueprint.render_as_hash(@meter.reload) },
               status: :created
      end

      private

      def set_meter
        @meter = current_organization.meters.find(params[:meter_id])
      end
    end
  end
end
