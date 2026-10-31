// What the report endpoints send. The server's spec/contracts/report_shapes_spec.rb checks each response against a
// fixture in src/test/fixtures/reports, and the web tests load those same fixtures into these types, so a field that
// is renamed on one side fails on the other. Dates are text (YYYY-MM-DD); money and hours are numbers.

export interface TrendPoint { date: string; created: number; completed: number; resolution_hours: number }

export interface PriorityDetail {
  priority: string
  created: number
  completed: number
  open: number
  avg_hours: number
  overdue_pct: number
}

export interface WorkOrderSummary {
  period: { from: string; to: string; days: number }
  totals: {
    created: number
    completed: number
    cancelled: number
    avg_resolution_hours: number
    overdue_rate: number
    first_time_fix_rate: number
  }
  by_priority: Record<string, { created: number; completed: number; avg_hours: number }>
  by_priority_detail: PriorityDetail[]
  by_status: Record<string, number>
  trend: TrendPoint[]
  completion_heatmap: { date: string; count: number }[]
}

export interface MttrRow { name: string; wo_count: number; avg_hours: number; min_hours: number; max_hours: number }

export interface MttrReport {
  overall_avg: number
  by_group: { asset: MttrRow[]; location: MttrRow[]; technician: MttrRow[] }
}

export interface BacklogReport {
  total_open: number
  aging: { bucket: string; critical: number; high: number; medium: number; low: number }[]
  oldest_wos: {
    id: number
    work_order_number: string
    title: string
    asset_name: string | null
    priority: string
    days_open: number
    assignee_name: string | null
  }[]
}

export interface LocationHealthRow {
  location: string
  total: number
  operational: number
  degraded: number
  down: number
  health_score: number
}

export type InventoryAsset = {
  id: number
  name: string
  asset_tag: string
  status: string
  location: string | null
  open_work_orders: number
  total_work_orders: number
  sensor_alerts: number
}

export interface AssetHealth {
  health_score: number
  total: number
  by_status: { operational: number; degraded: number; down: number; decommissioned: number }
  by_location: LocationHealthRow[]
  recently_degraded: { id: number; name: string; asset_tag: string; status: string }[]
  most_maintained: { id: number; name: string; asset_tag: string; work_order_count: number }[]
  assets: InventoryAsset[]
}

export interface AssetHistory {
  asset: { id: number; name: string; tag: string }
  summary: {
    total_work_orders: number
    total_downtime_hours: number
    avg_resolution_hours: number
    total_maintenance_cost: number
    pm_compliance_rate: number
    iot_alerts_total: number
  }
  /** The last twelve months, oldest first; `month` is the first day of the month. */
  monthly: { month: string; corrective: number; pm: number; iot: number }[]
  timeline: { date: string; type: string; title: string; status: string }[]
}

// type aliases (not interfaces): the Cost page reads them as plain records
export type CostSummary = {
  total_cost: number
  labor_cost: number
  parts_cost: number
  vendor_cost: number
  work_orders_count: number
  avg_cost_per_wo: number
  group_by: string
  trend: { period: string; labor: number; parts: number; vendor: number; total: number; wo_count: number }[]
}

export type CostByAsset = {
  assets: { asset_id: number | null; asset_name: string; labor_cost: number; parts_cost: number; vendor_cost: number; total_cost: number; wo_count: number }[]
  treemap: { name: string; cost: number }[]
  total_assets: number
}

export type DowntimeFigures = {
  /** Percent of the hours the asset existed in the period that it was not down. */
  availability: number
  downtime_hours: number
  /** Stops that began in the period. */
  failures: number
  /** Mean time between failures, in hours; null without a failure. */
  mtbf_hours: number | null
  /** Mean time to restore, in hours; null without a failure. */
  mttr_hours: number | null
}

export type DowntimeRow = DowntimeFigures & {
  id: number
  name: string
  asset_tag: string
  location: string | null
  down_now: boolean
}

export interface DowntimeReport {
  period: { from: string; to: string }
  summary: DowntimeFigures & { assets: number; down_now: number }
  assets: DowntimeRow[]
}

export type CostByVendor = {
  vendors: { vendor_id: number; vendor_name: string; vendor_cost: number; wo_count: number }[]
}

/** A rate that is null when nothing has come due: "no data", not 0 or 100. */
type PmTally = { scheduled: number; completed: number; skipped: number; missed: number; compliance_rate: number | null }

export interface PmCompliance {
  overall_compliance_rate: number | null
  period: { from: string; to: string }
  summary: { scheduled: number; completed: number; skipped: number; missed: number }
  by_month: (PmTally & { month: string })[]
  by_location: (PmTally & { location: string })[]
  worst_performing_assets: { asset_name: string; total: number; completed: number; missed: number; compliance_rate: number | null }[]
}

export interface PmForecast {
  forecast_days: number
  total_upcoming: number
  estimated_hours: number
  by_week: {
    week_start: string
    total_estimated_hours: number
    pms: {
      pm_id: number
      name: string
      priority: string
      asset: string
      due_date: string
      /** One of time_based, meter_based, calendar_based, condition_based. */
      frequency_type: string
      frequency_value: number | null
      frequency_unit: string | null
      estimated_hours: number
      assigned_to: string | null
    }[]
  }[]
}

export interface IotAlertsReport {
  total_alerts: number
  critical_count: number
  resolved_rate: number
  open_count: number
  work_orders_created: number
  trend: { period: string; critical: number; high: number; medium: number; low: number; resolved: number }[]
  /** Only when exactly one asset is chosen in the Filters. */
  sensor_series: { metric: string; unit: string; data: { time: string; value: number }[] }[]
}

export type IotRuleRow = {
  rule_id: number
  rule_name: string
  asset_name: string | null
  status: string
  trigger_count: number
  wo_created: number
  resolve_rate: number
  avg_resolution_hours: number
}

export interface IotRuleEffectiveness {
  active_count: number
  rules: IotRuleRow[]
}
