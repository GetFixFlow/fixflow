import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PmFrequencyType, PmFrequencyUnit } from '@/types'

interface PMFrequencyBadgeProps {
  frequencyType: PmFrequencyType
  frequencyValue?: number
  frequencyUnit?: PmFrequencyUnit
  calendarDayOfMonth?: number
  calendarDayOfWeek?: number
  className?: string
}

function formatFrequency(type: PmFrequencyType, value?: number, unit?: PmFrequencyUnit, dom?: number, dow?: number): string {
  switch (type) {
    case 'time_based':
      if (!value || !unit) return 'Periodic'
      if (unit === 'days' && value === 1) return 'Daily'
      if (unit === 'weeks' && value === 1) return 'Weekly'
      if (unit === 'months' && value === 1) return 'Monthly'
      if (unit === 'months' && value === 3) return 'Quarterly'
      if (unit === 'months' && value === 12) return 'Annually'
      return `Every ${value} ${unit}`
    case 'meter_based':
      return `Every ${value ?? '?'} ${unit ?? 'hours'}`
    case 'calendar_based': {
      if (dom) return `Monthly (${dom}${dom === 1 ? 'st' : dom === 2 ? 'nd' : dom === 3 ? 'rd' : 'th'})`
      const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return `Every ${DAYS[dow ?? 0]}`
    }
    case 'condition_based':
      return 'Condition-based'
    default:
      return 'Periodic'
  }
}

export function PMFrequencyBadge({ frequencyType, frequencyValue, frequencyUnit, calendarDayOfMonth, calendarDayOfWeek, className }: PMFrequencyBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', className)}>
      <RefreshCw className="h-3 w-3" />
      {formatFrequency(frequencyType, frequencyValue, frequencyUnit, calendarDayOfMonth, calendarDayOfWeek)}
    </span>
  )
}

export { formatFrequency }
