import { AlertCircle } from 'lucide-react'
import { differenceInCalendarDays, format, isToday, isTomorrow } from 'date-fns'
import { cn } from '@/lib/utils'

interface WorkOrderDueDateProps {
  dueDate?: string | null
  className?: string
}

export function WorkOrderDueDate({ dueDate, className }: WorkOrderDueDateProps) {
  if (!dueDate) {
    return (
      <span className={cn('text-sm italic text-gray-400 dark:text-gray-500', className)}>
        No due date
      </span>
    )
  }

  const date = new Date(dueDate)
  const diffDays = differenceInCalendarDays(date, new Date())

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays)
    return (
      <span
        className={cn(
          'flex items-center gap-1 text-sm font-medium text-red-600 dark:text-red-400',
          className,
        )}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`}
      </span>
    )
  }

  if (isToday(date)) {
    return (
      <span className={cn('text-sm font-medium text-orange-600 dark:text-orange-400', className)}>
        Today
      </span>
    )
  }

  if (isTomorrow(date)) {
    return (
      <span className={cn('text-sm font-medium text-yellow-600 dark:text-yellow-400', className)}>
        Tomorrow
      </span>
    )
  }

  if (diffDays <= 3) {
    return (
      <span className={cn('text-sm font-medium text-yellow-600 dark:text-yellow-400', className)}>
        In {diffDays} days
      </span>
    )
  }

  return (
    <span className={cn('text-sm text-gray-600 dark:text-gray-400', className)}>
      {format(date, 'MMM d')}
    </span>
  )
}
