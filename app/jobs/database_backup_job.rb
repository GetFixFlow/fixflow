require "English"

class DatabaseBackupJob < ApplicationJob
  queue_as :scheduled

  RETENTION_DAYS = 30
  # When the nightly backup runs (config/sidekiq.yml: "0 3 * * *"; the application's time zone is UTC).
  RUNS_AT = "03:00 UTC".freeze
  # A run that fails (a storage that was briefly out of reach, say) is tried again; only when the last try fails
  # is anyone told, so one bad night is one email, not one per try.
  ATTEMPTS = 3
  RETRY_AFTER = 15.minutes

  # Backups are made by the production server only (a development database is not worth keeping).
  def self.runs_here? = Rails.env.production?

  retry_on(StandardError, wait: RETRY_AFTER, attempts: ATTEMPTS) { |job, error| job.give_up(error) }

  def perform
    return unless self.class.runs_here?

    started_at  = Time.current
    filename    = "fixflow_#{started_at.strftime('%Y%m%d_%H%M%S')}.sql.gz"
    local_path  = Rails.root.join("tmp", filename)
    store       = BackupStore.new

    run_dump(local_path)
    store.put(filename, local_path)
    store.delete_older_than(RETENTION_DAYS.days.ago)

    duration = (Time.current - started_at).round(1)
    size_mb   = (File.size(local_path).to_f / 1.megabyte).round(2)
    Rails.logger.info("[Backup] Completed in #{duration}s — #{size_mb} MB — #{filename}")
  rescue StandardError => e
    Rails.logger.error("[Backup] Failed (try #{executions} of #{ATTEMPTS}): #{e.class} — #{e.message}")
    raise
  ensure
    File.delete(local_path) if local_path && File.exist?(local_path)
  end

  # The last try failed: write it to the audit log and email the administrators.
  def give_up(error)
    reason = describe(error)
    Rails.logger.error("[Backup] Giving up after #{ATTEMPTS} tries: #{reason}")
    ActsAsTenant.without_tenant do
      Organization.find_each do |organization|
        ActivityLogService.log(action: "backup.failed", resource: organization, user: nil,
                               metadata: { error: reason, attempts: ATTEMPTS })
      end
      User.active.where(role: "admin").find_each { |admin| tell(admin, reason) }
    end
  end

  private

  # Without the password a database or storage address may carry, and not longer than a mail should be.
  def describe(error)
    "#{error.class}: #{error.message}".gsub(%r{://[^/\s@]+@}, "://").truncate(500)
  end

  def tell(admin, reason)
    BackupMailer.failed(admin, reason, Time.current).deliver_later
  rescue StandardError => e
    Rails.logger.error("[Backup] Could not queue the failure email to #{admin.email}: #{e.class} — #{e.message}")
  end

  def run_dump(local_path)
    db_url = ENV.fetch("DATABASE_URL")
    uri    = URI.parse(db_url)

    env = {
      "PGPASSWORD" => uri.password.to_s,
      "PGHOST"     => uri.host,
      "PGPORT"     => (uri.port || 5432).to_s,
      "PGUSER"     => uri.user
    }
    db_name = uri.path.delete_prefix("/")

    # No shell: the database name is passed as one argument, never interpolated into a command.
    # No owners or privileges, so the dump restores under any database user (see DatabaseRestore).
    dumped = false
    Zlib::GzipWriter.open(local_path) do |gzip|
      IO.popen(env, ["pg_dump", "--no-owner", "--no-acl", "--dbname=#{db_name}"], "rb") { |dump| IO.copy_stream(dump, gzip) }
      dumped = $CHILD_STATUS.success?
    end
    raise "pg_dump failed" unless dumped
  end
end
