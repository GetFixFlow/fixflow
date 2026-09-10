import { AlertCircle, Clock } from 'lucide-react'
import { differenceInCalendarDays, isToday, isTomorrow, format } from 'date-fns'
import { cn } from '@/lib/utils'

interface PMDueDateDisplayProps { dueDate?: string | null; className?: string; showIcon?: boolean }

export function PMDueDateDisplay({ dueDate, className, showIcon = true }: PMDueDateDisplayProps) {
  if (!dueDate) return <span className={cn('text-gray-400 italic text-sm', className)}>No due date</span>

  const date = new Date(dueDate)
  const diff = differenceInCalendarDays(date, new Date())

  if (diff < 0) {
    const days = Math.abs(diff)
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm font-medium text-red-600 dark:text-red-400', className)}>
        {showIcon && <AlertCircle className="h-3.5 w-3.5" />}
        {days === 1 ? '1 day overdue' : `${days} days overdue`}
      </span>
    )
  }
  if (isToday(date)) return <span className={cn('text-sm font-bold text-orange-600 dark:text-orange-400', className)}>Due today</span>
  if (isTomorrow(date)) return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium text-yellow-600 dark:text-yellow-400', className)}>
      {showIcon && <Clock className="h-3.5 w-3.5" />}Due tomorrow
    </span>
  )
  if (diff <= 7) return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400', className)}>
      {showIcon && <Clock className="h-3.5 w-3.5" />}Due in {diff} days
    </span>
  )
  return <span className={cn('text-sm text-gray-600 dark:text-gray-400', className)}>{format(date, 'MMM d, yyyy')}</span>
}
