import { CloudOff } from 'lucide-react'
import { useToggleChecklistStep } from '@/hooks/useWorkOrders'
import { formatDateTime } from '@/lib/localeFormat'
import { cn } from '@/lib/utils'
import type { ChecklistItem } from '@/types'

interface WorkOrderChecklistProps {
  workOrderId: number
  items: ChecklistItem[]
  editable?: boolean
}

export function WorkOrderChecklist({ workOrderId, items, editable = true }: WorkOrderChecklistProps) {
  const toggle = useToggleChecklistStep(workOrderId)

  const completedCount = items.filter((i) => i.completed).length
  const requiredRemaining = items.filter((i) => i.required !== false && !i.completed)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-1.5 w-full min-w-48 rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-1.5 rounded-full bg-brand-600 transition-all"
              style={{ width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {completedCount}/{items.length} steps completed
          </p>
        </div>
      </div>

      <ul className="space-y-1" role="list">
        {items.map((item) => (
          <li key={item.step} className="flex items-start gap-3">
            {/* A tap target big enough for a gloved thumb: the whole row is the label. */}
            <label
              htmlFor={`checklist-${item.step}`}
              className={cn('flex flex-1 items-start gap-3 rounded-md py-2', editable && 'cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/40')}
            >
              <input
                type="checkbox"
                id={`checklist-${item.step}`}
                checked={!!item.completed}
                onChange={() => toggle.mutate({ step: item.step, completed: !item.completed })}
                disabled={!editable}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                aria-label={item.instruction}
              />
              <span className="flex-1 text-sm">
                <span className={item.completed ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}>
                  {item.instruction}
                </span>
                {item.required !== false && !item.completed && <span className="ml-1.5 text-xs text-red-500">*required</span>}
                {item.pending && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <CloudOff className="h-3 w-3" /> Waiting to sync
                  </span>
                )}
                {item.completed && !item.pending && item.completed_by_name && (
                  <span className="block text-xs text-gray-400 dark:text-gray-500">
                    Done by {item.completed_by_name}
                    {item.completed_at ? `, ${formatDateTime(item.completed_at)}` : ''}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {requiredRemaining.length > 0 && (
        <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          <strong>{requiredRemaining.length} required step{requiredRemaining.length !== 1 && 's'} not complete:</strong>
          <ul className="mt-1 list-disc pl-4 text-xs">
            {requiredRemaining.map((i) => (
              <li key={i.step}>{i.instruction}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
