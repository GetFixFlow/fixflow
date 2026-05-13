module Api
  module V1
    class HealthController < Api::V1::BaseController
      skip_before_action :authenticate_user!
      skip_before_action :set_current_context

      BOOT_TIME = Time.current

      def show
        checks  = run_checks
        overall = checks.values.all? { |c| c[:status] == "ok" } ? "ok" : "degraded"
        http_status = checks.slice(:database, :redis).values.all? { |c| c[:status] == "ok" } ? :ok : :service_unavailable

        render json: {
          status:          overall,
          version:         ENV.fetch("APP_VERSION", "0.1.0"),
          checks:          checks,
          uptime_seconds:  (Time.current - BOOT_TIME).to_i,
          timestamp:       Time.current.iso8601
        }, status: http_status
      end

      private

      def run_checks
        {
          database: check_database,
          redis:    check_redis,
          sidekiq:  check_sidekiq,
          storage:  check_storage
        }
      end

      def check_database
        start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        ActiveRecord::Base.connection.execute("SELECT 1")
        latency = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round(2)
        { status: "ok", latency_ms: latency }
      rescue StandardError => e
        { status: "error", error: e.message }
      end

      def check_redis
        start     = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        redis_url = ENV.fetch("REDIS_URL", "redis://localhost:6379/0")
        result    = Redis.new(url: redis_url).ping
        latency   = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round(2)
        result == "PONG" ? { status: "ok", latency_ms: latency } : { status: "error" }
      rescue StandardError => e
        { status: "error", error: e.message }
      end

      def check_sidekiq
        stats = Sidekiq::Stats.new
        { status: "ok", queued_jobs: stats.enqueued, failed_jobs: stats.failed }
      rescue StandardError => e
        { status: "error", error: e.message }
      end

      def check_storage
        ActiveStorage::Blob.service.exist?("health_check_dummy_key")
        { status: "ok", accessible: true }
      rescue StandardError
        { status: "ok", accessible: false }  # storage issues are non-critical warnings
      end
    end
  end
end
