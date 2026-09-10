import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SkipForward } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePMExecutions } from '@/hooks/usePreventiveMaintenance'
import type { PmExecutionStatus } from '@/types'

const STATUS_BADGE: Record<PmExecutionStatus, 'success' | 'warning' | 'destructive' | 'secondary' | 'default'> = {
  completed: 'success',
  generated: 'default',
  pending: 'warning',
  skipped: 'secondary',
  missed: 'destructive',
}

interface PMExecutionTableProps { pmId: number; onSkip: (executionId: number) => void }

export function PMExecutionTable({ pmId, onSkip }: PMExecutionTableProps) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = usePMExecutions(pmId, { page, per_page: 10 })
  const executions = data?.executions ?? []

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )

  if (executions.length === 0) return (
    <p className="text-sm text-gray-500 italic py-4">No executions yet. PM will generate its first work order when triggered.</p>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-2 text-left">Scheduled</th>
            <th className="pb-2 text-left">Status</th>
            <th className="pb-2 text-left">Work Order</th>
            <th className="pb-2 text-left">Notes</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {executions.map((ex) => (
            <tr key={ex.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2 pr-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
                {format(new Date(ex.scheduled_date), 'MMM d, yyyy')}
              </td>
              <td className="py-2 pr-4">
                <Badge variant={STATUS_BADGE[ex.status]}>{ex.status}</Badge>
              </td>
              <td className="py-2 pr-4">
                {ex.work_order_id ? (
                  <Link to={`/work-orders/${ex.work_order_id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                    {ex.work_order?.work_order_number ?? `WO #${ex.work_order_id}`}
                  </Link>
                ) : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-2 pr-4 text-gray-500 max-w-xs truncate">{ex.skip_reason ?? ex.notes ?? ''}</td>
              <td className="py-2 text-right">
                {ex.status === 'pending' && (
                  <Button variant="ghost" size="sm" onClick={() => onSkip(ex.id)}>
                    <SkipForward className="h-3.5 w-3.5 mr-1" />Skip
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="disabled:opacity-40 hover:text-gray-700">← Prev</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={executions.length < 10} className="disabled:opacity-40 hover:text-gray-700">Next →</button>
      </div>
    </div>
  )
}
