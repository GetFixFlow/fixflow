module Api
  module V1
    class HealthController < Api::V1::BaseController
      skip_before_action :authenticate_user!

      def show
        render json: {
          status: "ok",
          version: "0.1.0",
          timestamp: Time.current.iso8601,
          database: database_status,
          redis: redis_status
        }
      end

      private

      def database_status
        ActiveRecord::Base.connection.execute("SELECT 1")
        "connected"
      rescue StandardError
        "unavailable"
      end

      def redis_status
        Redis.new(url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0")).ping == "PONG" ? "connected" : "unavailable"
      rescue StandardError
        "unavailable"
      end
    end
  end
end
