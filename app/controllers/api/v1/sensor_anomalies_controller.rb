module Api
  module V1
    # Sensor readings flagged as unusual (see Iot::AnomalyDetector). Anyone who can see sensor alerts can see them; a manager says
    # whether one is real (acknowledge) or nothing (dismiss).
    class SensorAnomaliesController < Api::V1::BaseController
      before_action :require_technician_or_above!, only: :index
      before_action :require_manager!, only: %i[acknowledge dismiss]
      before_action :set_anomaly, only: %i[acknowledge dismiss]

      rescue_from SensorAnomaly::InvalidTransition do |e|
        render_error(e.message, :unprocessable_entity, code: "INVALID_TRANSITION")
      end

      # GET /api/v1/sensor_anomalies  (status, asset_id)
      def index
        anomalies = company_anomalies.recent
        anomalies = anomalies.where(status: params[:status]) if params[:status].present?
        anomalies = anomalies.for_asset(params[:asset_id]) if params[:asset_id].present?
        render_paginated(anomalies, SensorAnomalyBlueprint, key: :sensor_anomalies)
      end

      # PATCH /api/v1/sensor_anomalies/:id/acknowledge  { notes }
      def acknowledge
        @anomaly.acknowledge!(by: current_user, notes: params[:notes])
        render json: { data: SensorAnomalyBlueprint.render_as_hash(@anomaly) }
      end

      # PATCH /api/v1/sensor_anomalies/:id/dismiss  { notes }
      def dismiss
        @anomaly.dismiss!(by: current_user, notes: params[:notes])
        render json: { data: SensorAnomalyBlueprint.render_as_hash(@anomaly) }
      end

      private

      def company_anomalies
        SensorAnomaly.where(organization_id: current_organization.id).includes(:acknowledged_by, asset: :location)
      end

      def set_anomaly
        @anomaly = company_anomalies.find(params[:id])
      end
    end
  end
end
