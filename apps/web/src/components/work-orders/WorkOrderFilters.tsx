import { label as word } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { Search, X, ChevronDown, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { WorkOrderStatus, Priority } from '@/types'

export interface WorkOrderFilterState {
  search: string
  statuses: WorkOrderStatus[]
  priorities: Priority[]
  assignee_id?: number | null
  asset_id?: number | null
  location_id?: number | null
  due_from?: string
  due_to?: string
  source?: string
  overdue_only?: boolean
}

const ALL_STATUSES: WorkOrderStatus[] = [
  'open',
  'assigned',
  'in_progress',
  'on_hold',
  'pending_parts',
  'completed',
  'verified',
  'cancelled',
]

const ALL_PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low']

interface FilterChipProps {
  label: string
  onRemove: () => void
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
      {label}
      <button
        onClick={onRemove}
        aria-label={t('workOrders.filters.remove', { label })}
        className="rounded-full p-0.5 hover:bg-brand-200 dark:hover:bg-brand-800"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

interface MultiSelectDropdownProps {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (values: string[]) => void
}

function MultiSelectDropdown({ label, options, selected, onChange }: MultiSelectDropdownProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="relative group">
      <button
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors',
          selected.length > 0
            ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-900/30 dark:text-brand-300'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      <div className="absolute left-0 top-10 z-20 hidden min-w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg group-hover:block group-focus-within:block dark:border-gray-700 dark:bg-gray-800">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 dark:text-brand-400"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )
}

interface WorkOrderFiltersProps {
  filters: WorkOrderFilterState
  onChange: (filters: WorkOrderFilterState) => void
  showAssigneeFilter?: boolean
}

export function WorkOrderFilters({ filters, onChange, showAssigneeFilter = false }: WorkOrderFiltersProps) {
  const { t } = useTranslation()
  const update = (partial: Partial<WorkOrderFilterState>) => onChange({ ...filters, ...partial })

  const activeChips: { label: string; onRemove: () => void }[] = []

  filters.statuses.forEach((s) => {
    activeChips.push({
      label: t('workOrders.filters.status_chip', { status: word('status', s) }),
      onRemove: () => update({ statuses: filters.statuses.filter((x) => x !== s) }),
    })
  })

  filters.priorities.forEach((p) => {
    activeChips.push({
      label: t('workOrders.filters.priority_chip', { priority: word('priority', p) }),
      onRemove: () => update({ priorities: filters.priorities.filter((x) => x !== p) }),
    })
  })

  if (filters.overdue_only) {
    activeChips.push({ label: t('workOrders.filters.overdue'), onRemove: () => update({ overdue_only: false }) })
  }

  const hasFilters =
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.search ||
    filters.overdue_only

  return (
    <div className="space-y-2">
      {/* Row 1: search + dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <Input
            className="pl-9"
            placeholder={t('workOrders.filters.search')}
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        <MultiSelectDropdown
          label={t('workOrders.filters.status')}
          options={ALL_STATUSES.map((s) => ({ value: s, label: word('status', s) }))}
          selected={filters.statuses}
          onChange={(vals) => update({ statuses: vals as WorkOrderStatus[] })}
        />

        <MultiSelectDropdown
          label={t('workOrders.filters.priority')}
          options={ALL_PRIORITIES.map((p) => ({
            value: p,
            label: word('priority', p),
          }))}
          selected={filters.priorities}
          onChange={(vals) => update({ priorities: vals as Priority[] })}
        />

        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
          <input
            type="checkbox"
            checked={filters.overdue_only ?? false}
            onChange={(e) => update({ overdue_only: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 dark:text-brand-400"
          />
          <Filter className="h-3.5 w-3.5" />
          {t('workOrders.filters.overdue')}
        </label>
      </div>

      {/* Row 2: active chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
          {hasFilters && (
            <button
              onClick={() =>
                onChange({
                  search: '',
                  statuses: [],
                  priorities: [],
                  overdue_only: false,
                })
              }
              className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {t('workOrders.filters.clear')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
