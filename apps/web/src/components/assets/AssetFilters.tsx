import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LocationSelect } from '@/components/shared/LocationSelect'
import type { AssetStatus, Location } from '@/types'
import { label } from '@/i18n'

export interface AssetFilterState {
  search: string
  status: AssetStatus | ''
  location_id: number | null
}

interface AssetFiltersProps {
  filters: AssetFilterState
  onChange: (filters: AssetFilterState) => void
  locations: Location[]
  totalCount?: number
}

const STATUS_VALUES: AssetStatus[] = ['operational', 'degraded', 'down', 'decommissioned']

export function AssetFilters({ filters, onChange, locations, totalCount }: AssetFiltersProps) {
  const { t } = useTranslation()
  const hasActiveFilters = filters.status !== '' || filters.location_id != null

  const clearAll = () =>
    onChange({ search: filters.search, status: '', location_id: null })

  const removeFilter = (key: keyof AssetFilterState) =>
    onChange({ ...filters, [key]: key === 'location_id' ? null : '' })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder={t('assets.filters.search_placeholder')}
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            aria-label={t('assets.filters.search_aria')}
          />
        </div>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value as AssetStatus | '' })}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          aria-label={t('assets.filters.status_aria')}
        >
          <option value="">{t('assets.filters.all_statuses')}</option>
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {label('status', value)}
            </option>
          ))}
        </select>

        {/* Location */}
        <div className="w-56">
          <LocationSelect
            locations={locations}
            value={filters.location_id}
            onChange={(id) => onChange({ ...filters, location_id: id })}
            placeholder={t('assets.filters.all_locations')}
          />
        </div>

        {totalCount != null && (
          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {t('assets.filters.count', { count: totalCount })}
          </span>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.status && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => removeFilter('status')}
            >
              {t('assets.filters.status_chip', { status: label('status', filters.status) })}
              <X className="h-3 w-3" aria-hidden="true" />
            </Badge>
          )}
          {filters.location_id != null && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => removeFilter('location_id')}
            >
              {t('assets.filters.location_chip')}
              <X className="h-3 w-3" aria-hidden="true" />
            </Badge>
          )}
          <button
            onClick={clearAll}
            className="text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('assets.filters.clear_all')}
          </button>
        </div>
      )}
    </div>
  )
}
