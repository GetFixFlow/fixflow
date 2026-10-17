# Nightly: removes audit log lines older than the company's retention setting (Settings, Data Retention); nothing
# when the log is kept for ever, which is the default. See Retention.
class AuditLogCleanupJob < ApplicationJob
  queue_as :scheduled
  # When it runs (config/sidekiq.yml: "30 2 * * *"; the application's time zone is UTC).
  RUNS_AT = "02:30 UTC".freeze

  def perform
    ActsAsTenant.without_tenant do
      Organization.find_each do |organization|
        next unless organization.audit_log_retention_days

        removed = Retention.new(organization).sweep_audit_log!
        Rails.logger.info "[AuditLogCleanupJob] #{organization.name}: removed #{removed[:lines]} lines"
      end
    end
  end
end
