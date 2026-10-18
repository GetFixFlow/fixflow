# What the company's data takes up and what the retention settings will remove, for Settings, Data Retention. Real
# figures from the database, not estimates of capacity: FixFlow does not know how big the disk is.
class DataUsage
  # A count past the limit that takes longer than this (a very large table, a busy server) is left out rather than
  # holding the page up; the page then says it does not know.
  COUNT_TIMEOUT = "5s".freeze
  TABLES = {
    sensor_readings: SensorReading, sensor_aggregates: SensorAggregate, activity_logs: ActivityLog,
    iot_alerts: IotAlert, work_orders: WorkOrder
  }.freeze

  # `sensor_days` and `audit_days` ask how much would go if the limits were these (the page asks before an
  # administrator saves a shorter one); without them, the saved settings.
  def initialize(organization, sensor_days: nil, audit_days: nil)
    @organization = organization
    @retention = Retention.new(organization, sensor_days: sensor_days, audit_days: audit_days)
  end

  def call
    {
      database_bytes: connection.select_value("SELECT pg_database_size(current_database())").to_i,
      tables: TABLES.to_h { |name, model| [name, table(name, model)] },
      attachments: { count: ActiveStorage::Blob.count, bytes: ActiveStorage::Blob.sum(:byte_size).to_i },
      sensor_data: sensor_data,
      audit_log: audit_log,
      cleanup_at: { sensor_data: Iot::CleanupReadingsJob::RUNS_AT, audit_log: AuditLogCleanupJob::RUNS_AT },
      backups: backups
    }
  end

  private

  def connection = ActiveRecord::Base.connection

  def table(name, model)
    { bytes: connection.select_value("SELECT pg_total_relation_size(#{connection.quote(name.to_s)}::regclass)").to_i,
      rows: row_count(name, model) }
  end

  # Sensor readings run to millions: the planner's own estimate (kept fresh by autovacuum) is close enough and instant.
  def row_count(name, model)
    return model.unscoped.count unless name == :sensor_readings

    estimate = connection.select_value("SELECT reltuples::bigint FROM pg_class WHERE relname = 'sensor_readings'").to_i
    estimate.positive? ? estimate : model.unscoped.count
  end

  def sensor_data
    { retention_days: @organization.sensor_retention_days, checked_days: @retention.sensor_days,
      oldest_at: oldest(SensorReading, :recorded_at),
      removable_readings: bounded { @retention.old_readings.count }, removable_summaries: bounded { @retention.old_summaries.count } }
  end

  def audit_log
    { retention_days: @organization.audit_log_retention_days, checked_days: @retention.audit_days,
      oldest_at: oldest(ActivityLog, :created_at), removable_lines: bounded { @retention.old_audit_lines.count } }
  end

  def oldest(model, column)
    model.unscoped.where(organization_id: @organization.id).minimum(column)&.iso8601
  end

  # nil when the count was cut off (see COUNT_TIMEOUT).
  def bounded
    ActiveRecord::Base.transaction do
      connection.execute("SET LOCAL statement_timeout = '#{COUNT_TIMEOUT}'")
      yield
    end
  rescue ActiveRecord::QueryCanceled
    nil
  end

  def backups
    { runs: DatabaseBackupJob.runs_here?, at: DatabaseBackupJob::RUNS_AT, keep_days: DatabaseBackupJob::RETENTION_DAYS,
      bucket: BackupStore.bucket, tries: DatabaseBackupJob::ATTEMPTS, retry_minutes: DatabaseBackupJob::RETRY_AFTER.in_minutes.to_i }
  end
end
