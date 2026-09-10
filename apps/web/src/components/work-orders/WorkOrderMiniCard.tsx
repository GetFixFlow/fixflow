import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge'
import { WorkOrderPriorityBadge } from './WorkOrderPriorityBadge'
import { WorkOrderDueDate } from './WorkOrderDueDate'
import type { WorkOrder } from '@/types'

interface WorkOrderMiniCardProps {
  workOrder: WorkOrder
  className?: string
}

export function WorkOrderMiniCard({ workOrder, className }: WorkOrderMiniCardProps) {
  return (
    <Link
      to={`/work-orders/${workOrder.id}`}
      className={cn(
        'block rounded-lg border border-gray-200 bg-white p-3 hover:border-brand-300 hover:shadow-sm transition-all dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-600',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-mono text-xs text-gray-400">{workOrder.work_order_number}</span>
            <WorkOrderPriorityBadge priority={workOrder.priority} size="sm" />
          </div>
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {workOrder.title}
          </p>
          <WorkOrderDueDate dueDate={workOrder.due_date} className="mt-1" />
        </div>
        <WorkOrderStatusBadge status={workOrder.status} size="sm" />
      </div>
    </Link>
  )
}
