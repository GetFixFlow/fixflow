module Api
  module V1
    # When an asset stopped and when it ran again. An asset that is "down" has an open downtime (the status keeps the two
    # together, see Asset); a stop nobody recorded at the time is entered here with both times.
    class DowntimesController < Api::V1::BaseController
      LIST_LIMIT = 200

      before_action :set_asset, only: %i[index create]
      before_action :set_downtime, only: %i[update restart destroy]
      before_action :authorize_downtime

      # GET /api/v1/assets/:asset_id/downtimes  (newest first)
      def index
        downtimes = @asset.downtimes.includes(:started_by, :ended_by).newest_first.limit(LIST_LIMIT)
        render json: { downtimes: DowntimeBlueprint.render_as_hash(downtimes) }
      end

      # POST /api/v1/assets/:asset_id/downtimes  { downtime: { started_at, ended_at, reason } }
      # With ended_at it is a stop that is over. Without, the asset is down now (from started_at, or from this moment).
      def create
        downtime = downtime_params[:ended_at].present? ? record_past_stop : stop_now
        return unless downtime

        render json: { data: DowntimeBlueprint.render_as_hash(downtime) }, status: :created
      end

      # PATCH /api/v1/downtimes/:id  { downtime: { started_at, ended_at, reason } }  Giving the end of an open one restarts the asset.
      def update
        attrs = downtime_params
        AssetDowntime.transaction do
          changes = attrs.slice(:started_at, :reason)
          changes.delete(:started_at) if changes[:started_at].blank?
          @downtime.update!(changes)
          restart_asset(attrs[:ended_at]) if @downtime.open? && attrs[:ended_at].present?
        end
        render json: { data: DowntimeBlueprint.render_as_hash(@downtime) }
      end

      # POST /api/v1/downtimes/:id/restart  { ended_at } (default: now). The asset is operational again.
      def restart
        return render_error("This asset is already running.", :unprocessable_entity, code: "NOT_DOWN") unless @downtime.open?

        AssetDowntime.transaction { restart_asset(params[:ended_at]) }
        render json: { data: DowntimeBlueprint.render_as_hash(@downtime) }
      end

      # DELETE /api/v1/downtimes/:id  (one that is still going on has to be ended first)
      def destroy
        if @downtime.open?
          return render_error("This asset is still down. Restart it before deleting the record.", :unprocessable_entity,
                              code: "STILL_DOWN")
        end

        @downtime.destroy!
        head :no_content
      end

      private

      def stop_now
        if @asset.status == "decommissioned"
          render_error("A decommissioned asset cannot be marked as down.", :unprocessable_entity, code: "DECOMMISSIONED")
          return
        end
        if @asset.downtimes.open.exists?
          render_error("This asset is already down.", :unprocessable_entity, code: "ALREADY_DOWN")
          return
        end

        AssetDowntime.transaction do
          @asset.update!(status: "down") # opens the downtime, from now
          downtime = @asset.downtimes.open.first ||
                     @asset.downtimes.create!(organization: current_organization, started_at: Time.current, started_by: current_user)
          downtime.update!(downtime_params.slice(:started_at, :reason).compact_blank)
          downtime
        end
      end

      def record_past_stop
        @asset.downtimes.create!(downtime_params.merge(organization: current_organization, started_by: current_user,
                                                       ended_by: current_user))
      end

      def restart_asset(at)
        @downtime.update!(ended_at: at.presence || Time.current, ended_by: current_user)
        @downtime.asset.update!(status: "operational") if @downtime.asset.status == "down"
      end

      def set_asset
        @asset = current_organization.assets.kept.find(params[:asset_id])
      end

      def set_downtime
        @downtime = current_organization.asset_downtimes.find(params[:id])
      end

      def authorize_downtime
        authorize(@downtime || AssetDowntime)
      end

      def downtime_params
        params.expect(downtime: %i[started_at ended_at reason])
      end
    end
  end
end
