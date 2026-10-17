module Api
  module V1
    # What the data takes up and how much of it the retention settings will remove tonight (Settings, Data Retention).
    # Administrators only.
    class DataUsageController < Api::V1::BaseController
      before_action :require_admin!

      # GET /api/v1/data_usage
      # `sensor_days` and `audit_days` ask what would be removed if the limits were these (nothing is changed).
      def show
        response.set_header("Cache-Control", "no-store")
        render json: DataUsage.new(current_organization, sensor_days: days(:sensor_days, 1), audit_days: days(:audit_days, 0)).call
      end

      private

      # The number of days asked about, or nil (use the saved setting) when it is missing or not a sensible number.
      def days(name, minimum)
        value = Integer(params[name].to_s, exception: false)
        value if value && (minimum..3650).cover?(value)
      end
    end
  end
end
