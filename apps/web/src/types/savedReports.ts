export type SavedReportKind = 'work_orders' | 'asset_health' | 'pm_compliance'
export type SavedReportPeriod = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month' | 'last_month'

/** The Filters panel's lists, as kept with a saved report (a list that is empty is left out). */
export interface SavedReportFilters {
  location_ids?: number[]
  asset_ids?: number[]
  user_ids?: number[]
  priorities?: string[]
  sources?: string[]
}

export interface SavedReport {
  id: number
  name: string
  report: SavedReportKind
  title: string
  period: SavedReportPeriod
  filters: SavedReportFilters
  /** The weekday it is emailed, 0 (Sunday) to 6; null when it is not emailed. */
  send_on: number | null
  recipient_ids: number[]
  recipients: { id: number; full_name: string }[]
  owner: { id: number; full_name: string }
  last_sent_on: string | null
  last_sent_at: string | null
  /** Why the last attempt failed, or which addresses it could not reach. */
  last_error: string | null
  /** Whether the person asking can change or delete it. */
  editable: boolean
  created_at: string
}

export interface EligibleRecipient {
  id: number
  full_name: string
  role: string
}
