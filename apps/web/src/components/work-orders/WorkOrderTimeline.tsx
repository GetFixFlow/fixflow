import { CheckCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkOrderStatus } from '@/types'

const STAGE_ORDER: WorkOrderStatus[] = ['open', 'assigned', 'in_progress', 'completed', 'verified']
const STAGE_LABELS: Partial<Record<WorkOrderStatus, string>> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  verified: 'Verified',
}

interface WorkOrderTimelineProps {
  status: WorkOrderStatus
}

export function WorkOrderTimeline({ status }: WorkOrderTimelineProps) {
  const currentIdx = STAGE_ORDER.indexOf(status)
  // cancelled/on_hold/pending_parts don't move the stage index forward
  const effectiveIdx = currentIdx === -1 ? 0 : currentIdx

  return (
    <div className="flex items-center gap-0" aria-label="Work order progress">
      {STAGE_ORDER.map((stage, idx) => {
        const done = idx < effectiveIdx
        const active = idx === effectiveIdx
        const isLast = idx === STAGE_ORDER.length - 1

        return (
          <div key={stage} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors',
                  done
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : active
                    ? 'border-brand-600 bg-white text-brand-600 dark:bg-gray-900'
                    : 'border-gray-300 bg-white text-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-600',
                )}
                aria-label={`${STAGE_LABELS[stage]} — ${done ? 'completed' : active ? 'current' : 'pending'}`}
              >
                {done ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Circle className="h-3 w-3 fill-current" />
                )}
              </div>
              <span
                className={cn(
                  'mt-1 hidden text-[10px] font-medium sm:block',
                  done || active
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-gray-400 dark:text-gray-500',
                )}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>

            {!isLast && (
              <div
                className={cn(
                  'mb-4 h-0.5 flex-1 transition-colors',
                  done ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
