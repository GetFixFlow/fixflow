import { rangeFor, storeDate } from '@/lib/savedReports'
import { useReportStore } from '@/stores/reportStore'
import type { SavedReport } from '@/types/savedReports'

/** Puts a saved report's filters and the dates its period means today into the Reports filters, replacing what was there. */
export function applySavedReport(saved: SavedReport, today: Date = new Date()) {
  const { from, to } = rangeFor(saved.period, today)
  useReportStore.setState({
    dateFrom: storeDate(from),
    dateTo: storeDate(to),
    filters: {
      location_ids: saved.filters.location_ids ?? [],
      asset_ids: saved.filters.asset_ids ?? [],
      user_ids: saved.filters.user_ids ?? [],
      priorities: saved.filters.priorities ?? [],
      sources: saved.filters.sources ?? [],
    },
  })
}
