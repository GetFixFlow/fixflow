# Removes what is older than the limits the company chose (Settings, Data Retention): sensor readings and their hourly
# summaries, and audit log lines. Nothing else is ever removed by age: work orders, assets, alerts, comments and the
# rest stay until a person deletes them.
#
# A sensor reading that raised an IoT alert is kept whatever its age: the alert points at it as its evidence (and the
# database would refuse to delete it). Removal is in small batches, so a large backlog never holds the tables locked.
# What was removed is written to the audit log as a line by the system.
class Retention
  BATCH = 5_000
  # Not deletable: a reading an alert points at.
  NOT_AN_ALERTS_EVIDENCE = "NOT EXISTS (SELECT 1 FROM iot_alerts WHERE iot_alerts.sensor_reading_id = sensor_readings.id)".freeze

  # `sensor_days` and `audit_days` ask "what if the limit were this" (0 days for the audit log: for ever); without
  # them the company's saved settings are used.
  def initialize(organization, now: Time.current, sensor_days: nil, audit_days: nil)
    @organization = organization
    @now = now
    @sensor_days = sensor_days
    @audit_days = audit_days
  end

  def sensor_days = @sensor_days || @organization.sensor_retention_days

  # nil when the audit log is kept for ever.
  def audit_days
    return @organization.audit_log_retention_days if @audit_days.nil?

    @audit_days.positive? ? @audit_days : nil
  end

  def sensor_cutoff = @now - sensor_days.days

  def audit_cutoff
    days = audit_days
    @now - days.days if days
  end

  # The readings and the hourly summaries past the limit.
  def old_readings
    SensorReading.unscoped.where(organization_id: @organization.id).where(recorded_at: ...sensor_cutoff)
                 .where(NOT_AN_ALERTS_EVIDENCE)
  end

  def old_summaries
    SensorAggregate.where(asset_id: Asset.unscoped.where(organization_id: @organization.id).select(:id))
                   .where(period_start: ...sensor_cutoff)
  end

  # Audit lines past the limit; none when the log is kept for ever.
  def old_audit_lines
    cutoff = audit_cutoff
    return ActivityLog.unscoped.none unless cutoff

    ActivityLog.unscoped.where(organization_id: @organization.id).where(created_at: ...cutoff)
  end

  # => { readings:, summaries: }
  def sweep_sensor_data!
    removed = { readings: delete_in_batches(old_readings), summaries: delete_in_batches(old_summaries) }
    record("retention.sensor_data_removed", removed.merge(older_than_days: sensor_days)) if removed.values.any?(&:positive?)
    removed
  end

  # => { lines: }
  def sweep_audit_log!
    removed = { lines: delete_in_batches(old_audit_lines) }
    record("retention.audit_log_removed", removed.merge(older_than_days: audit_days)) if removed[:lines].positive?
    removed
  end

  private

  def delete_in_batches(scope)
    total = 0
    loop do
      ids = scope.limit(BATCH).pluck(:id)
      break if ids.empty?

      total += scope.klass.unscoped.where(id: ids).delete_all
    end
    total
  end

  def record(action, metadata)
    ActivityLogService.log(action: action, resource: @organization, user: nil, metadata: metadata)
  end
end
