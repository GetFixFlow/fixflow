module Iot
  class CleanupReadingsJob < ApplicationJob
    queue_as :scheduled

    def perform
      retention_days = ENV.fetch("IOT_RETENTION_DAYS", 90).to_i
      deleted = SensorReading.cleanup_old_readings(retention_days: retention_days)
      Rails.logger.info "[Iot::CleanupReadingsJob] Deleted #{deleted} readings older than #{retention_days} days"
    end
  end
end
