import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { WorkOrderKanbanCard } from './WorkOrderKanbanCard'
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge'
import { useTransitionWorkOrder } from '@/hooks/useWorkOrders'
import type { WorkOrder, WorkOrderStatus } from '@/types'

const KANBAN_COLUMNS: WorkOrderStatus[] = [
  'open',
  'assigned',
  'in_progress',
  'on_hold',
  'completed',
]

const COLUMN_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  pending_parts: 'Pending Parts',
  completed: 'Completed',
  verified: 'Verified',
  cancelled: 'Cancelled',
}

const TRANSITION_EVENTS: Partial<Record<WorkOrderStatus, string>> = {
  assigned: 'assign',
  in_progress: 'start',
  on_hold: 'hold',
  completed: 'complete',
}

interface WorkOrderKanbanBoardProps {
  workOrders: WorkOrder[]
}

interface DragState {
  cardId: number
  sourceColumn: WorkOrderStatus
}

export function WorkOrderKanbanBoard({ workOrders }: WorkOrderKanbanBoardProps) {
  const navigate = useNavigate()
  const transition = useTransitionWorkOrder()
  const [dragOver, setDragOver] = useState<WorkOrderStatus | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const byStatus = KANBAN_COLUMNS.reduce<Record<WorkOrderStatus, WorkOrder[]>>(
    (acc, col) => {
      acc[col] = workOrders.filter((wo) => wo.status === col)
      return acc
    },
    {} as Record<WorkOrderStatus, WorkOrder[]>,
  )

  const handleDrop = (targetStatus: WorkOrderStatus) => {
    if (!drag || drag.sourceColumn === targetStatus) return
    const event = TRANSITION_EVENTS[targetStatus]
    if (event) {
      transition.mutate({ id: drag.cardId, event })
    }
    setDrag(null)
    setDragOver(null)
  }

  return (
    <div
      className="flex gap-4 overflow-x-auto pb-4"
      role="region"
      aria-label="Work orders kanban board"
    >
      {KANBAN_COLUMNS.map((col) => {
        const cards = byStatus[col] ?? []
        return (
          <div
            key={col}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50',
              dragOver === col && 'ring-2 ring-brand-400',
            )}
            role="group"
            aria-label={COLUMN_LABELS[col]}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(col)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(col)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <WorkOrderStatusBadge status={col} size="sm" showIcon={false} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {COLUMN_LABELS[col]}
                </span>
              </div>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: '70vh' }}>
              {cards.map((wo) => (
                <div
                  key={wo.id}
                  draggable
                  onDragStart={() => setDrag({ cardId: wo.id, sourceColumn: col })}
                  onDragEnd={() => {
                    setDrag(null)
                    setDragOver(null)
                  }}
                  className={cn(drag?.cardId === wo.id && 'opacity-50')}
                >
                  <WorkOrderKanbanCard workOrder={wo} />
                </div>
              ))}

              {cards.length === 0 && (
                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                  <p className="text-xs text-gray-400">Drop here</p>
                </div>
              )}
            </div>

            {/* Add button */}
            <div className="border-t border-gray-200 p-2 dark:border-gray-700">
              <button
                onClick={() => navigate(`/work-orders/new?status=${col}`)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Add work order
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
