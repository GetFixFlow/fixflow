module Api
  module V1
    class IotAlertsController < Api::V1::BaseController
      before_action :require_manager!, only: %i[acknowledge resolve]
      before_action :set_alert, only: %i[show acknowledge resolve]

      # GET /api/v1/iot_alerts
      def index
        alerts = IotAlert
          .joins(:asset)
          .where(assets: { organization_id: current_organization.id })
          .recent

        alerts = alerts.where(status: params[:status])       if params[:status].present?
        alerts = alerts.for_asset(params[:asset_id])         if params[:asset_id].present?
        alerts = alerts.since(Time.parse(params[:from]))     if params[:from].present?
        alerts = alerts.until_time(Time.parse(params[:to]))  if params[:to].present?

        render_paginated(alerts, IotAlertBlueprint, key: :iot_alerts)
      end

      # GET /api/v1/iot_alerts/:id
      def show
        render json: { data: IotAlertBlueprint.render_as_hash(@alert) }
      end

      # PATCH /api/v1/iot_alerts/:id/acknowledge
      def acknowledge
        @alert.update!(
          status:           :acknowledged,
          acknowledged_by:  current_user,
          acknowledged_at:  Time.current,
          notes:            params[:notes]
        )
        @alert.iot_rule.increment!(:times_acknowledged)
        render json: { data: IotAlertBlueprint.render_as_hash(@alert) }
      end

      # PATCH /api/v1/iot_alerts/:id/resolve
      def resolve
        @alert.update!(
          status:      :resolved,
          resolved_at: Time.current,
          notes:       params[:notes].presence || @alert.notes
        )
        render json: { data: IotAlertBlueprint.render_as_hash(@alert) }
      end

      private

      def set_alert
        @alert = IotAlert
          .joins(:asset)
          .where(assets: { organization_id: current_organization.id })
          .find(params[:id])
      end
    end
  end
end
