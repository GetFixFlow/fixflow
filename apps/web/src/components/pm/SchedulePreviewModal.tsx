import { format, addDays } from 'date-fns'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePreviewSchedule } from '@/hooks/usePreventiveMaintenance'
import { cn } from '@/lib/utils'
import type { PreventiveMaintenance } from '@/types'
import { formatDate } from '@/lib/localeFormat'

// Client-side schedule preview calculator (used in create form before PM is saved)
export function calculatePreviewDates(
  frequencyType: string,
  frequencyValue?: number,
  frequencyUnit?: string,
  startDate?: string,
  count = 12,
): { date: Date; daysUntil: number; warnings: string[] }[] {
  const start = startDate ? new Date(startDate) : new Date()
  const results: { date: Date; daysUntil: number; warnings: string[] }[] = []
  let current = new Date(start)
  const today = new Date()

  for (let i = 0; i < count; i++) {
    if (i > 0) {
      const val = frequencyValue ?? 1
      const unit = frequencyUnit ?? 'months'
      if (unit === 'days') current = addDays(current, val)
      else if (unit === 'weeks') current = addDays(current, val * 7)
      else if (unit === 'months') { current = new Date(current); current.setMonth(current.getMonth() + val) }
      else current = addDays(current, val * 30)
    }
    const daysUntil = Math.round((current.getTime() - today.getTime()) / 86400000)
    const warnings: string[] = []
    const dow = current.getDay()
    if (dow === 0 || dow === 6) warnings.push(`Falls on a ${dow === 0 ? 'Sunday' : 'Saturday'}`)
    results.push({ date: new Date(current), daysUntil, warnings })
  }
  return results
}

interface SchedulePreviewModalProps {
  open: boolean
  onClose: () => void
  pmId?: number
  pm?: PreventiveMaintenance
  // For create form (before save) — provide calculated dates instead
  previewDates?: ReturnType<typeof calculatePreviewDates>
}

export function SchedulePreviewModal({ open, onClose, pmId, pm, previewDates }: SchedulePreviewModalProps) {
  const { data, isLoading } = usePreviewSchedule(pmId)
  // Client-calculated dates and API items use different field names; normalise them once.
  const items = previewDates
    ? previewDates.map((d) => ({ date: d.date, daysUntil: d.daysUntil, warnings: d.warnings }))
    : (data?.items ?? []).map((i) => ({ date: new Date(i.date), daysUntil: i.days_until, warnings: i.warnings ?? [] }))

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">Schedule Preview</Dialog.Title>
              {pm && <p className="text-sm text-gray-500 mt-0.5">{pm.name}</p>}
            </div>
            <Dialog.Close asChild><button className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button></Dialog.Close>
          </div>

          {isLoading && !previewDates ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="overflow-y-auto max-h-96">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-400 uppercase">
                    <th className="pb-2 text-left w-6">#</th>
                    <th className="pb-2 text-left">Date</th>
                    <th className="pb-2 text-left">Day</th>
                    <th className="pb-2 text-left">Until</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {items.map((item, idx) => {
                    const { date, daysUntil, warnings } = item
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{formatDate(date)}</td>
                        <td className="py-2 text-gray-500">{format(date, 'EEEE')}</td>
                        <td className={cn('py-2 text-xs', daysUntil < 0 ? 'text-red-500' : daysUntil <= 7 ? 'text-orange-500' : 'text-gray-400')}>
                          {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Today' : `in ${daysUntil}d`}
                          {warnings.length > 0 && <span className="ml-1 text-orange-400" title={warnings.join(', ')}><AlertTriangle className="h-3 w-3 inline" /></span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
