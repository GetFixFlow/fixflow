import { create } from 'zustand'
import { subDays } from 'date-fns'

interface ReportFilters {
  location_ids: number[]
  asset_ids: number[]
  user_ids: number[]
  priorities: string[]
  sources: string[]
}

interface ReportStore {
  dateFrom: Date
  dateTo: Date
  compareMode: boolean
  filters: ReportFilters
  setDateRange: (from: Date, to: Date) => void
  setFilter: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void
  resetFilters: () => void
  toggleCompare: () => void
  getParams: () => Record<string, unknown>
}

const DEFAULT_FILTERS: ReportFilters = {
  location_ids: [], asset_ids: [], user_ids: [],
  priorities: [], sources: [],
}

export const useReportStore = create<ReportStore>(
  (set: (partial: Partial<ReportStore> | ((s: ReportStore) => Partial<ReportStore>)) => void, get: () => ReportStore) => ({
    dateFrom: subDays(new Date(), 30),
    dateTo: new Date(),
    compareMode: false,
    filters: DEFAULT_FILTERS,

    setDateRange: (from: Date, to: Date) => set({ dateFrom: from, dateTo: to }),
    setFilter: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) =>
      set((s: ReportStore) => ({ filters: { ...s.filters, [key]: value } })),
    resetFilters: () => set({ filters: DEFAULT_FILTERS }),
    toggleCompare: () => set((s: ReportStore) => ({ compareMode: !s.compareMode })),

    getParams: () => {
      const { dateFrom, dateTo, filters } = get()
      return {
        from: dateFrom.toISOString().slice(0, 10),
        to: dateTo.toISOString().slice(0, 10),
        ...(filters.location_ids.length ? { location_ids: filters.location_ids } : {}),
        ...(filters.asset_ids.length ? { asset_ids: filters.asset_ids } : {}),
        ...(filters.user_ids.length ? { user_ids: filters.user_ids } : {}),
        ...(filters.priorities.length ? { priorities: filters.priorities } : {}),
        ...(filters.sources.length ? { sources: filters.sources } : {}),
      }
    },
  }),
)
