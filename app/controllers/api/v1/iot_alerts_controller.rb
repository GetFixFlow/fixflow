module Api
  module V1
    class IotAlertsController < Api::V1::BaseController
      # The most alerts one bulk request may name.
      MAX_BULK = 200

      before_action :require_manager!, only: %i[acknowledge resolve suppress bulk_acknowledge bulk_resolve]
      before_action :set_alert, only: %i[show acknowledge resolve suppress]

      rescue_from IotAlert::InvalidTransition do |e|
        render_error(e.message, :unprocessable_entity, code: "INVALID_TRANSITION")
      end

      # GET /api/v1/iot_alerts  (status, severity, asset_id, from, to)
      def index
        alerts = filter(company_alerts).recent
        render_paginated(alerts, IotAlertBlueprint, key: :iot_alerts)
      end

      # GET /api/v1/iot_alerts/:id
      def show
        render json: { data: IotAlertBlueprint.render_as_hash(@alert) }
      end

      # PATCH /api/v1/iot_alerts/:id/acknowledge
      def acknowledge
        @alert.acknowledge!(by: current_user, notes: params[:notes])
        render json: { data: IotAlertBlueprint.render_as_hash(@alert) }
      end

      # PATCH /api/v1/iot_alerts/:id/resolve
      def resolve
        @alert.resolve!(notes: params[:notes])
        render json: { data: IotAlertBlueprint.render_as_hash(@alert) }
      end

      # PATCH /api/v1/iot_alerts/:id/suppress
      def suppress
        @alert.suppress!
        render json: { data: IotAlertBlueprint.render_as_hash(@alert) }
      end

      # PATCH /api/v1/iot_alerts/bulk_acknowledge  { ids: [1, 2, 3] }
      def bulk_acknowledge
        bulk { |alert| alert.acknowledge!(by: current_user) }
      end

      # PATCH /api/v1/iot_alerts/bulk_resolve  { ids: [1, 2, 3] }
      def bulk_resolve
        bulk(&:resolve!)
      end

      private

      # Every alert of the company, with what the screens show loaded.
      def company_alerts
        IotAlert.joins(:asset)
                .where(assets: { organization_id: current_organization.id })
                .includes(:iot_rule, :work_order, :acknowledged_by, asset: :location)
      end

      def filter(alerts)
        alerts = alerts.where(status: params[:status])   if params[:status].present?
        alerts = alerts.for_asset(params[:asset_id])     if params[:asset_id].present?
        alerts = alerts.since(parse_time(:from))         if params[:from].present?
        alerts = alerts.until_time(parse_time(:to))      if params[:to].present?
        if params[:severity].present?
          alerts = alerts.joins(:iot_rule).where(iot_rules: { wo_priority: IotRule.wo_priorities.values_at(params[:severity]) })
        end
        alerts
      end

      def parse_time(name)
        Time.zone.parse(params[name].to_s) || raise(ArgumentError)
      rescue ArgumentError
        raise ActionController::BadRequest, "#{name} is not a date or time"
      end

      # Each alert that can make the move does, and the rest are skipped (already resolved, not the company's, unknown):
      # one that cannot does not stop the others.
      def bulk
        ids = bulk_ids
        updated = 0
        company_alerts.where(id: ids).find_each do |alert|
          yield(alert)
          updated += 1
        rescue IotAlert::InvalidTransition
          next
        end
        render json: { updated: updated, skipped: ids.size - updated }
      end

      def bulk_ids
        ids = Array(params[:ids]).filter_map { |value| Integer(value, exception: false) }.uniq
        raise ActionController::BadRequest, "ids must name at least one alert" if ids.empty?
        raise ActionController::BadRequest, "no more than #{MAX_BULK} alerts at a time" if ids.size > MAX_BULK

        ids
      end

      def set_alert
        @alert = company_alerts.find(params[:id])
      end
    end
  end
end
