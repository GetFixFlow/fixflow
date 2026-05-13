module Api
  module V1
    class ActivityLogsController < Api::V1::BaseController
      before_action :require_manager!

      def index
        logs = ActivityLog.where(organization_id: current_organization.id).recent

        logs = logs.by_resource(params[:resource_type])        if params[:resource_type].present?
        logs = logs.for_resource(params[:resource_type], params[:resource_id]) if params[:resource_id].present?
        logs = logs.by_user(params[:user_id])                  if params[:user_id].present?
        logs = logs.by_action(params[:action])                 if params[:action].present?
        logs = logs.since(Time.zone.parse(params[:from]))      if params[:from].present?
        logs = logs.until_time(Time.zone.parse(params[:to]))   if params[:to].present?

        render_paginated(logs, ActivityLogBlueprint, key: :activity_logs)
      end
    end
  end
end
