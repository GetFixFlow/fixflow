import { useNavigate } from 'react-router-dom'
import { MessageSquare, Paperclip, MapPin, User, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge'
import { WorkOrderPriorityBadge } from './WorkOrderPriorityBadge'
import { WorkOrderDueDate } from './WorkOrderDueDate'
import type { WorkOrder } from '@/types'

const PRIORITY_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-400',
  low: 'border-l-blue-400',
}

interface WorkOrderKanbanCardProps {
  workOrder: WorkOrder
  commentCount?: number
  attachmentCount?: number
  onStatusChange?: (wo: WorkOrder) => void
}

export function WorkOrderKanbanCard({
  workOrder: wo,
  commentCount = 0,
  attachmentCount = 0,
}: WorkOrderKanbanCardProps) {
  const navigate = useNavigate()
  const borderClass = PRIORITY_BORDER[wo.priority] ?? 'border-l-gray-300'

  const locationPath = wo.asset?.location
    ? wo.asset.location.name
    : null

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${wo.work_order_number}: ${wo.title}`}
      onClick={() => navigate(`/work-orders/${wo.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/work-orders/${wo.id}`)}
      className={cn(
        'cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow dark:border-gray-700 dark:bg-gray-800',
        'border-l-4',
        borderClass,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <WorkOrderPriorityBadge priority={wo.priority} size="sm" />
        <span className="font-mono text-xs text-gray-400 shrink-0">{wo.work_order_number}</span>
      </div>

      {/* Title */}
      <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
        {wo.title}
      </p>

      {/* Location */}
      {locationPath && (
        <div className="mb-1.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{locationPath}</span>
        </div>
      )}

      {/* Assignee */}
      {wo.assignee && (
        <div className="mb-1.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{wo.assignee.full_name}</span>
        </div>
      )}

      {/* Due date */}
      {wo.due_date && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Calendar className="h-3 w-3 shrink-0" />
          <WorkOrderDueDate dueDate={wo.due_date} />
        </div>
      )}

      {/* Footer: counts + status */}
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" /> {commentCount}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" /> {attachmentCount}
            </span>
          )}
        </div>
        <WorkOrderStatusBadge status={wo.status} size="sm" />
      </div>
    </div>
  )
}
