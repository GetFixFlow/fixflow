import { apiClient } from './client'

export interface TableUsage { bytes: number; rows: number }

/** What the company's data takes up and what the retention settings will remove (administrators only). */
export interface DataUsage {
  database_bytes: number
  tables: {
    sensor_readings: TableUsage
    sensor_aggregates: TableUsage
    activity_logs: TableUsage
    iot_alerts: TableUsage
    work_orders: TableUsage
  }
  attachments: { count: number; bytes: number }
  sensor_data: {
    retention_days: number
    /** The limit the counts below are for: the saved one, or the one asked about. */
    checked_days: number
    oldest_at: string | null
    /** Null when counting took too long. */
    removable_readings: number | null
    removable_summaries: number | null
  }
  audit_log: {
    /** Null: kept for ever. */
    retention_days: number | null
    checked_days: number | null
    oldest_at: string | null
    removable_lines: number | null
  }
  cleanup_at: { sensor_data: string; audit_log: string }
  backups: {
    runs: boolean
    at: string
    keep_days: number
    bucket: string
    /** True when the backups are kept on another storage (BACKUP_S3_*), not on the one that holds the data. */
    separate: boolean
    /** A failed backup is tried this many times in all, `retry_minutes` apart; the administrators are told after the last. */
    tries: number
    retry_minutes: number
  }
}

export const dataUsageApi = {
  /** `sensorDays` and `auditDays` (0: for ever) ask what would be removed if the limits were these; nothing changes. */
  get: (params?: { sensorDays?: number; auditDays?: number }) =>
    apiClient
      .get<DataUsage>('/data_usage', { params: { sensor_days: params?.sensorDays, audit_days: params?.auditDays } })
      .then((r) => r.data),
}
