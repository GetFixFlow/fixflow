import { addMonths, endOfMonth, format, startOfMonth, subDays } from 'date-fns'
import type { SavedReport, SavedReportFilters, SavedReportKind, SavedReportPeriod } from '@/types/savedReports'

export const PERIOD_LABELS: Record<SavedReportPeriod, string> = {
  last_7_days: 'The last 7 days',
  last_30_days: 'The last 30 days',
  last_90_days: 'The last 90 days',
  this_month: 'This month so far',
  last_month: 'Last month',
}

export const REPORT_PATHS: Record<SavedReportKind, string> = {
  work_orders: '/reports/work-orders',
  asset_health: '/reports/assets',
  pm_compliance: '/reports/pm-compliance',
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const weekdayName = (day: number) => WEEKDAYS[day]

/** The hour a scheduled report goes out, company time. (ScheduledReportsJob::SEND_HOUR on the server.) */
export const SEND_HOUR = 7

const ymd = (date: Date) => format(date, 'yyyy-MM-dd')

/**
 * The dates a period means on `today`, as YYYY-MM-DD. The last N days are the whole days before today, so a report sent
 * on Monday morning is about a finished week. Mirrors SavedReport.range_for on the server, and must give the same dates.
 */
export function rangeFor(period: SavedReportPeriod, today: Date): { from: string; to: string } {
  switch (period) {
    case 'last_7_days': return { from: ymd(subDays(today, 7)), to: ymd(subDays(today, 1)) }
    case 'last_30_days': return { from: ymd(subDays(today, 30)), to: ymd(subDays(today, 1)) }
    case 'last_90_days': return { from: ymd(subDays(today, 90)), to: ymd(subDays(today, 1)) }
    case 'this_month': return { from: ymd(startOfMonth(today)), to: ymd(today) }
    case 'last_month': {
      const last = addMonths(startOfMonth(today), -1)
      return { from: ymd(last), to: ymd(endOfMonth(last)) }
    }
  }
}

/** A date as the report store keeps it: midday, so that reading it back in any time zone gives the same day. */
export function storeDate(text: string): Date {
  const [year, month, day] = text.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

const FILTER_NAMES: [keyof SavedReportFilters, string, string][] = [
  ['location_ids', 'place', 'places'],
  ['asset_ids', 'asset', 'assets'],
  ['user_ids', 'person', 'people'],
  ['priorities', 'priority', 'priorities'],
  ['sources', 'source', 'sources'],
]

/** "2 places, 1 priority", or "No filters". */
export function filtersSummary(filters: SavedReportFilters): string {
  const parts = FILTER_NAMES.flatMap(([key, one, many]) => {
    const count = filters[key]?.length ?? 0
    return count > 0 ? [`${count} ${count === 1 ? one : many}`] : []
  })
  return parts.length > 0 ? parts.join(', ') : 'No filters'
}

/** "Mondays at 7:00, to Mia Manager and Ana Silva", or "Not emailed". */
export function scheduleSummary(saved: Pick<SavedReport, 'send_on' | 'recipients'>): string {
  if (saved.send_on === null) return 'Not emailed'
  const names = saved.recipients.map((person) => person.full_name)
  const who = names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} others`
  return `${weekdayName(saved.send_on)}s at ${SEND_HOUR}:00, to ${who}`
}

/** The Filters panel's current lists, without the empty ones, as a saved report keeps them. */
export function filtersFromStore(filters: Required<SavedReportFilters>): SavedReportFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, list]) => list.length > 0)) as SavedReportFilters
}
