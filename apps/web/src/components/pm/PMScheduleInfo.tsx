import { RefreshCw } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Card, CardContent } from '@/components/ui/Card'
import { PMDueDateDisplay } from './PMDueDateDisplay'
import { formatFrequency } from './PMFrequencyBadge'
import type { PreventiveMaintenance } from '@/types'

export function PMScheduleInfo({ pm }: { pm: PreventiveMaintenance }) {
  const dueAt = pm.next_due_at ?? pm.next_due_date
  const frequencyLabel = formatFrequency(pm.frequency_type, pm.frequency_value, pm.frequency_unit, pm.calendar_day_of_month, pm.calendar_day_of_week)

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <RefreshCw className="h-4 w-4 text-blue-500" />
          {frequencyLabel}
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Started</dt>
            <dd className="text-gray-900 dark:text-gray-100">{pm.start_date ? format(new Date(pm.start_date), 'MMM d, yyyy') : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Next Due</dt>
            <dd><PMDueDateDisplay dueDate={dueAt} showIcon={false} /></dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Last Run</dt>
            <dd className="text-gray-900 dark:text-gray-100">
              {pm.last_run_at ? formatDistanceToNow(new Date(pm.last_run_at), { addSuffix: true }) : 'Never'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">End Date</dt>
            <dd className="text-gray-900 dark:text-gray-100">{pm.end_date ? format(new Date(pm.end_date), 'MMM d, yyyy') : 'No end date'}</dd>
          </div>
          {pm.estimated_hours && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Est. Hours</dt>
              <dd className="text-gray-900 dark:text-gray-100">{pm.estimated_hours} hrs / occurrence</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  )
}
