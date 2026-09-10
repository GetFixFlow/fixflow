import { useUpdateChecklist } from '@/hooks/useWorkOrders'
import { cn } from '@/lib/utils'
import type { ChecklistItem } from '@/types'

interface WorkOrderChecklistProps {
  workOrderId: number
  items: ChecklistItem[]
  editable?: boolean
}

export function WorkOrderChecklist({ workOrderId, items, editable = true }: WorkOrderChecklistProps) {
  const update = useUpdateChecklist(workOrderId)

  const toggle = (id: string) => {
    if (!editable) return
    const updated = items.map((item) =>
      item.id === id
        ? {
            ...item,
            completed: !item.completed,
            completed_at: !item.completed ? new Date().toISOString() : undefined,
          }
        : item,
    )
    update.mutate(updated)
  }

  const completedCount = items.filter((i) => i.completed).length
  const requiredRemaining = items.filter((i) => i.required && !i.completed)

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

      <ul className="space-y-2" role="list">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <div className="mt-0.5">
              <input
                type="checkbox"
                id={`checklist-${item.id}`}
                checked={item.completed}
                onChange={() => toggle(item.id)}
                disabled={!editable || update.isPending}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                aria-label={item.description}
              />
            </div>
            <label
              htmlFor={`checklist-${item.id}`}
              className={cn(
                'flex-1 cursor-pointer text-sm',
                item.completed
                  ? 'text-gray-400 line-through dark:text-gray-500'
                  : 'text-gray-800 dark:text-gray-200',
              )}
            >
              {item.description}
              {item.required && !item.completed && (
                <span className="ml-1.5 text-xs text-red-500">*required</span>
              )}
            </label>
          </li>
        ))}
      </ul>

      {requiredRemaining.length > 0 && (
        <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          <strong>{requiredRemaining.length} required step{requiredRemaining.length !== 1 && 's'} not complete:</strong>
          <ul className="mt-1 list-disc pl-4 text-xs">
            {requiredRemaining.map((i) => (
              <li key={i.id}>{i.description}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
