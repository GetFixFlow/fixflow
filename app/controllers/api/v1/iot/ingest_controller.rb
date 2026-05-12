module Api
  module V1
    module Iot
      class IngestController < Api::V1::BaseController
        skip_before_action :authenticate_user!
        before_action :authenticate_api_key!

        def ingest
          asset = Asset.find(params[:asset_id])
          readings = params[:readings].to_unsafe_h

          readings.each do |metric_name, value|
            SensorReading.create!(
              asset: asset,
              metric_name: metric_name,
              value: value.to_f,
              unit: params[:units]&.dig(metric_name),
              recorded_at: params[:timestamp].present? ? Time.parse(params[:timestamp]) : Time.current
            )
          end

          IoTRuleEvaluatorJob.perform_later(asset.id, readings)

          render json: { message: "Readings ingested", count: readings.size }, status: :accepted
        end

        private

        def authenticate_api_key!
          key = request.headers["X-API-Key"]
          unless key.present? && ActiveSupport::SecurityUtils.secure_compare(key, ENV.fetch("IOT_API_KEY", ""))
            render json: { error: "Unauthorized" }, status: :unauthorized
          end
        end
      end
    end
  end
end
