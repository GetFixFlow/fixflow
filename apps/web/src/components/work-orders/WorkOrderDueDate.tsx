import { currentLanguage } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { differenceInCalendarDays, isToday, isTomorrow } from 'date-fns'
import { cn } from '@/lib/utils'

interface WorkOrderDueDateProps {
  dueDate?: string | null
  className?: string
}

export function WorkOrderDueDate({ dueDate, className }: WorkOrderDueDateProps) {
  const { t } = useTranslation()
  if (!dueDate) {
    return (
      <span className={cn('text-sm italic text-gray-500 dark:text-gray-400', className)}>
        {t('workOrders.due.none')}
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
        {t('workOrders.due.overdue', { count: overdueDays })}
      </span>
    )
  }

  if (isToday(date)) {
    return (
      <span className={cn('text-sm font-medium text-orange-700 dark:text-orange-400', className)}>
        {t('workOrders.due.today')}
      </span>
    )
  }

  if (isTomorrow(date)) {
    return (
      <span className={cn('text-sm font-medium text-yellow-700 dark:text-yellow-400', className)}>
        {t('workOrders.due.tomorrow')}
      </span>
    )
  }

  if (diffDays <= 3) {
    return (
      <span className={cn('text-sm font-medium text-yellow-700 dark:text-yellow-400', className)}>
        {t('workOrders.due.in_days', { count: diffDays })}
      </span>
    )
  }

  return (
    <span className={cn('text-sm text-gray-600 dark:text-gray-400', className)}>
      {new Intl.DateTimeFormat(currentLanguage(), { month: 'short', day: 'numeric' }).format(date)}
    </span>
  )
}
