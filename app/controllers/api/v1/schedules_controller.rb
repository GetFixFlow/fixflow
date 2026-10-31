module Api
  module V1
    class SchedulesController < Api::V1::BaseController
      before_action :require_manager!

      # GET /api/v1/schedule?from=2026-11-02&to=2026-11-08
      def show
        from = parse_date(:from)
        to = parse_date(:to)
        return render_error("from and to must be dates (YYYY-MM-DD)", :bad_request, code: "INVALID_DATE") unless from && to
        return render_error("to cannot be before from", :bad_request, code: "INVALID_RANGE") if to < from

        if (to - from).to_i >= TeamSchedule::MAX_DAYS
          return render_error("Ask for at most #{TeamSchedule::MAX_DAYS} days at a time", :bad_request, code: "RANGE_TOO_LONG")
        end

        render json: { data: TeamSchedule.new(current_organization, from: from, to: to).call }
      end

      private

      def parse_date(key)
        Date.iso8601(params[key].to_s)
      rescue Date::Error
        nil
      end
    end
  end
end
