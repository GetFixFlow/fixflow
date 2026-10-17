module Iot
  # Nightly: removes sensor readings and hourly summaries older than the company's retention setting
  # (Settings, Data Retention). See Retention.
  class CleanupReadingsJob < ApplicationJob
    queue_as :scheduled
    # When it runs (config/sidekiq.yml: "0 2 * * *"; the application's time zone is UTC).
    RUNS_AT = "02:00 UTC".freeze

    def perform
      ActsAsTenant.without_tenant do
        Organization.find_each do |organization|
          removed = Retention.new(organization).sweep_sensor_data!
          Rails.logger.info "[Iot::CleanupReadingsJob] #{organization.name}: removed #{removed[:readings]} readings " \
                            "and #{removed[:summaries]} summaries older than #{organization.sensor_retention_days} days"
        end
      end
    end
  end
end
