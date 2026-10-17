module Api
  module V1
    # The audit log: who did what to which record, newest first. Managers and administrators (the screen is the
    # administrator's). `.csv` is the same list as a file (at most MAX_EXPORT_ROWS lines, and it says if it was cut).
    class ActivityLogsController < Api::V1::BaseController
      MAX_EXPORT_ROWS = 50_000
      # The ending of an action ("asset.created" is a "created"): what the screen's "what happened" filter sends.
      VERBS = %w[created updated deleted restored revoked deactivated reactivated signed_in].freeze

      before_action :require_manager!

      def index
        logs = filtered_logs
        return send_csv(logs) if params[:format] == "csv"

        render_paginated(logs.includes(:user), ActivityLogBlueprint, key: :activity_logs)
      end

      private

      def filtered_logs
        logs = ActivityLog.where(organization_id: current_organization.id).recent
        logs = logs.by_resource(params[:resource_type])        if params[:resource_type].present?
        logs = logs.for_resource(params[:resource_type], params[:resource_id]) if params[:resource_id].present?
        logs = logs.by_user(params[:user_id])                  if params[:user_id].present?
        logs = logs.by_person_named(params[:person])           if params[:person].present?
        # Not params[:action]: Rails always sets that to the controller action ("index").
        logs = logs.by_action(params[:log_action])             if params[:log_action].present?
        logs = logs.with_verb(params[:verb])                   if VERBS.include?(params[:verb])
        logs = logs.named_like(params[:q])                     if params[:q].present?
        logs = logs.since(Time.zone.parse(params[:from]))      if params[:from].present?
        logs = logs.until_time(end_of_day(params[:to]))        if params[:to].present?
        logs
      end

      # A date on its own (what the screen sends) means the whole day.
      def end_of_day(text)
        time = Time.zone.parse(text)
        text.to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/) ? time&.end_of_day : time
      end

      def send_csv(logs)
        rows = logs.includes(:user).limit(MAX_EXPORT_ROWS + 1).to_a
        response.set_header("X-Export-Truncated", "true") if rows.size > MAX_EXPORT_ROWS
        send_data ExportService.activity_logs_csv(rows.first(MAX_EXPORT_ROWS)), type: "text/csv",
                                                                                filename: "audit_log_#{Time.zone.today}.csv"
      end
    end
  end
end
