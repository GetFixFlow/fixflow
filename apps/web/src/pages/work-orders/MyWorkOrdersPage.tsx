import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ScanLine, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useWorkOrders, useTransitionWorkOrder } from '@/hooks/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'
import { WorkOrderPriorityBadge } from '@/components/work-orders/WorkOrderPriorityBadge'
import { WorkOrderDueDate } from '@/components/work-orders/WorkOrderDueDate'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { WorkOrder } from '@/types'

const PRIORITY_BG: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50/30 dark:bg-red-900/10',
  high: 'border-l-orange-400',
  medium: 'border-l-yellow-400',
  low: 'border-l-blue-400',
}

function QuickActionButton({
  wo,
  onAction,
  isLoading,
}: {
  wo: WorkOrder
  onAction: (event: string) => void
  isLoading: boolean
}) {
  if (wo.status === 'open' && !wo.assignee_id) {
    return (
      <Button size="sm" onClick={() => onAction('assign_self')} loading={isLoading}>
        Assign to Me
      </Button>
    )
  }
  if (wo.status === 'assigned') {
    return (
      <Button size="sm" onClick={() => onAction('start')} loading={isLoading}>
        ▶ Start Work
      </Button>
    )
  }
  if (wo.status === 'in_progress') {
    return (
      <Button size="sm" onClick={() => onAction('complete')} loading={isLoading}>
        ✓ Complete
      </Button>
    )
  }
  if (wo.status === 'on_hold' || wo.status === 'pending_parts') {
    return (
      <Button size="sm" variant="outline" onClick={() => onAction('resume')} loading={isLoading}>
        ▶ Resume
      </Button>
    )
  }
  return null
}

export function MyWorkOrdersPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const transition = useTransitionWorkOrder()
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const { data, isLoading } = useWorkOrders({ my_work_orders: true })
  const allWOs = data?.work_orders ?? []

  const now = new Date()
  const overdue = allWOs.filter(
    (wo) =>
      wo.due_date &&
      new Date(wo.due_date) < now &&
      !['completed', 'verified', 'cancelled'].includes(wo.status),
  )

  const stats = {
    assigned: allWOs.filter((wo) => wo.status === 'assigned').length,
    in_progress: allWOs.filter((wo) => wo.status === 'in_progress').length,
    overdue: overdue.length,
  }

  const filtered = activeFilter
    ? allWOs.filter((wo) =>
        activeFilter === 'overdue'
          ? overdue.some((o) => o.id === wo.id)
          : wo.status === activeFilter,
      )
    : allWOs.filter((wo) => !['completed', 'verified', 'cancelled'].includes(wo.status))

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      {/* Compact header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Work Orders</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{format(now, 'EEEE, MMMM d')}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>
      </div>

      {/* Quick stats chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'assigned', label: `${stats.assigned} Assigned`, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
          { key: 'in_progress', label: `${stats.in_progress} In Progress`, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
          ...(stats.overdue > 0 ? [{ key: 'overdue', label: `${stats.overdue} Overdue`, color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' }] : []),
        ].map((chip) => (
          <button
            key={chip.key}
            onClick={() => setActiveFilter(activeFilter === chip.key ? null : chip.key)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all',
              chip.color,
              activeFilter === chip.key && 'ring-2 ring-brand-400',
            )}
          >
            {chip.label}
          </button>
        ))}
        {activeFilter && (
          <button
            onClick={() => setActiveFilter(null)}
            className="shrink-0 text-xs text-gray-500 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Work order cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 dark:border-gray-600">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeFilter ? 'No work orders match this filter.' : 'No active work orders. 🎉'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((wo) => {
            const isOverdue =
              wo.due_date &&
              new Date(wo.due_date) < now &&
              !['completed', 'verified', 'cancelled'].includes(wo.status)

            return (
              <div
                key={wo.id}
                className={cn(
                  'rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 border-l-4',
                  PRIORITY_BG[wo.priority] ?? '',
                )}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <WorkOrderPriorityBadge priority={wo.priority} size="sm" />
                    <span className="font-mono text-xs text-gray-400">{wo.work_order_number}</span>
                  </div>

                  <p className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{wo.title}</p>

                  {wo.asset?.location && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      📍 {wo.asset.location.name}
                    </p>
                  )}

                  <div className="mt-1 flex items-center gap-1">
                    ⏰ <WorkOrderDueDate dueDate={wo.due_date} />
                    {isOverdue && (
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-red-600">
                        <AlertTriangle className="h-3 w-3" /> OVERDUE
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 dark:border-gray-700">
                  <QuickActionButton
                    wo={wo}
                    onAction={(event) => transition.mutate({ id: wo.id, event })}
                    isLoading={transition.isPending}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                  >
                    View Details →
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Camera FAB */}
      <button
        onClick={() => navigate('/scan')}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700"
        aria-label="Scan QR code"
      >
        <ScanLine className="h-6 w-6" />
      </button>
    </div>
  )
}
