module Api
  module V1
    class IotController < Api::V1::BaseController
      # ── Authentication ─────────────────────────────────────────────────────
      # ingest uses API-key auth; all other actions use JWT (base default)
      skip_before_action :authenticate_user!,   only: :ingest
      skip_before_action :set_current_context,  only: :ingest
      before_action :authenticate_api_key!,     only: :ingest
      before_action :set_asset, only: %i[readings latest]

      # ── POST /api/v1/iot/ingest ────────────────────────────────────────────
      def ingest
        payload = parse_payload
        return render_error("Invalid JSON payload", :bad_request) if payload.nil?

        result = if payload.is_a?(Array)
          Iot::IngestionService.ingest_batch(@api_organization, payload, source: :rest_api)
        elsif payload["readings"].is_a?(Array)
          # bulk from one device
          asset = find_asset_from_payload(@api_organization, payload)
          return render_error("Asset not found", :unprocessable_entity) unless asset

          readings = payload["readings"].map do |r|
            r.merge("device_id" => payload["device_id"], "timestamp" => payload["timestamp"])
          end
          Iot::IngestionService.ingest(asset, readings, source: :rest_api, device_id: payload["device_id"])
        else
          asset = find_asset_from_payload(@api_organization, payload)
          return render_error("Asset not found", :unprocessable_entity) unless asset

          Iot::IngestionService.ingest(asset, [payload], source: :rest_api, device_id: payload["device_id"])
        end

        render json: result, status: :ok
      end

      # ── GET /api/v1/iot/assets/:id/readings ───────────────────────────────
      def readings
        scope = @asset.sensor_readings.recent

        scope = scope.for_metric(params[:metric])    if params[:metric].present?
        scope = scope.since(Time.parse(params[:from])) if params[:from].present?
        scope = scope.within_range(Time.parse(params[:from]), Time.parse(params[:to])) if params[:from].present? && params[:to].present?

        if params[:interval].present? && params[:interval] != "raw"
          period_type = params[:interval] == "daily" ? :daily : :hourly
          aggregates  = @asset.sensor_aggregates
            .for_period(period_type)
            .for_metric(params[:metric] || "%")
            .order(period_start: :desc)
            .limit(params.fetch(:limit, 100).to_i)
          render json: { asset_id: @asset.id, interval: params[:interval], aggregates: aggregates.as_json }
          return
        end

        scope = scope.limit(params.fetch(:limit, 100).to_i)
        render json: {
          asset_id:  @asset.id,
          readings:  SensorReadingBlueprint.render_as_hash(scope)
        }
      end

      # ── GET /api/v1/iot/assets/:id/latest ─────────────────────────────────
      def latest
        raw = SensorReading.latest_per_metric(@asset.id)
        readings_map = raw.each_with_object({}) do |r, h|
          h[r.metric_name] = {
            value:       r.value,
            unit:        r.unit,
            recorded_at: r.recorded_at
          }
        end

        render json: {
          asset_id:     @asset.id,
          asset_name:   @asset.name,
          readings:     readings_map,
          last_updated: raw.map(&:recorded_at).max
        }
      end

      private

      def set_asset
        @asset = current_organization.assets.find(params[:id])
      end

      def parse_payload
        return request.request_parameters if request.content_type&.include?("application/json")
        JSON.parse(request.body.read)
      rescue JSON::ParserError
        nil
      end

      def find_asset_from_payload(organization, payload)
        identifier = payload["asset_id"].to_s
        return nil if identifier.blank?
        organization.assets.find_by(id: identifier) ||
          organization.assets.find_by(asset_tag: identifier)
      end

      def authenticate_api_key!
        raw_key = request.headers["X-API-Key"].to_s
        api_key = ApiKey.authenticate(raw_key)

        if api_key
          @api_organization = api_key.organization
          ActsAsTenant.current_tenant = @api_organization
          api_key.touch_last_used
        else
          render json: { error: "Unauthorized" }, status: :unauthorized
        end
      end
    end
  end
end
