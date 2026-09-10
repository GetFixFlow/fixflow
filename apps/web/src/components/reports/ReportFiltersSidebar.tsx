import { useState, type ReactNode, type ChangeEvent } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { useReportStore } from '@/stores/reportStore'
import { format } from 'date-fns'

const PRIORITIES = ['critical', 'high', 'medium', 'low']
const SOURCES = ['manual', 'pm', 'iot']

interface SectionProps { title: string; children: ReactNode; defaultOpen?: boolean }
function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 pb-3 mb-3">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && children}
    </div>
  )
}

interface ReportFiltersSidebarProps {
  open: boolean
  onClose: () => void
  onApply?: () => void
}

export function ReportFiltersSidebar({ open, onClose, onApply }: ReportFiltersSidebarProps) {
  const { dateFrom, dateTo, compareMode, filters, setDateRange, setFilter, resetFilters, toggleCompare } = useReportStore()

  const activeFilterCount = [
    filters.location_ids.length, filters.asset_ids.length, filters.user_ids.length,
    filters.priorities.length, filters.sources.length,
  ].filter((n) => n > 0).length

  if (!open) return null

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-80 bg-white dark:bg-gray-900 shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            Filters {activeFilterCount > 0 && <span className="ml-1 rounded-full bg-brand-600 text-white text-xs px-1.5 py-0.5">{activeFilterCount}</span>}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <Section title="Date Range">
            <div className="grid grid-cols-2 gap-2 mb-2">
              {(['7d', '30d', '90d', 'year'] as const).map((r) => {
                const now = new Date()
                const ranges = {
                  '7d': [new Date(now.getTime() - 7*86400000), now],
                  '30d': [new Date(now.getTime() - 30*86400000), now],
                  '90d': [new Date(now.getTime() - 90*86400000), now],
                  'year': [new Date(now.getFullYear(), 0, 1), now],
                }
                return (
                  <button key={r} onClick={() => setDateRange(ranges[r][0], ranges[r][1])}
                    className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700">
                    {r === 'year' ? 'This Year' : r}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Input type="date" value={format(dateFrom, 'yyyy-MM-dd')}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDateRange(new Date(e.target.value), dateTo)} className="text-xs" />
              <Input type="date" value={format(dateTo, 'yyyy-MM-dd')}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDateRange(dateFrom, new Date(e.target.value))} className="text-xs" />
            </div>
            <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
              <input type="checkbox" checked={compareMode} onChange={toggleCompare} />
              Compare to previous period
            </label>
          </Section>

          <Section title="Priority">
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => (
                <button key={p} onClick={() => {
                  const current = filters.priorities
                  setFilter('priorities', current.includes(p) ? current.filter((x: string) => x !== p) : [...current, p])
                }}
                  className={cn('rounded-full border px-2.5 py-1 text-xs capitalize transition-all',
                    filters.priorities.includes(p) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-500')}>
                  {p}
                </button>
              ))}
            </div>
          </Section>

          <Section title="WO Source">
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button key={s} onClick={() => {
                  const current = filters.sources
                  setFilter('sources', current.includes(s) ? current.filter((x: string) => x !== s) : [...current, s])
                }}
                  className={cn('rounded-full border px-2.5 py-1 text-xs capitalize transition-all',
                    filters.sources.includes(s) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-500')}>
                  {s === 'pm' ? 'Preventive' : s === 'iot' ? 'IoT' : 'Manual'}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <Button className="w-full" onClick={() => { onApply?.(); onClose() }}>Apply Filters</Button>
          <button onClick={resetFilters} className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">Reset All Filters</button>
        </div>
      </div>
    </div>
  )
}
