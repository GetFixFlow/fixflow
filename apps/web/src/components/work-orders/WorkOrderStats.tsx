import { ClipboardList, PlayCircle, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkOrderStatsData {
  open?: number
  in_progress?: number
  completed_this_month?: number
  overdue?: number
  total?: number
}

interface WorkOrderStatsProps {
  stats: WorkOrderStatsData
  className?: string
}

export function WorkOrderStats({ stats, className }: WorkOrderStatsProps) {
  const items = [
    {
      label: 'Open',
      value: stats.open ?? 0,
      icon: ClipboardList,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'In Progress',
      value: stats.in_progress ?? 0,
      icon: PlayCircle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    {
      label: 'Completed',
      value: stats.completed_this_month ?? 0,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Overdue',
      value: stats.overdue ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
  ]

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700',
            item.bg,
          )}
        >
          <div className={cn('rounded-md p-1.5', item.bg)}>
            <item.icon className={cn('h-5 w-5', item.color)} />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Mini inline stats for other pages
export function WorkOrderStatsBadges({
  stats,
}: {
  stats: WorkOrderStatsData & { total?: number }
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(stats.total ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          <Clock className="h-3 w-3" />
          {stats.total} total
        </span>
      )}
      {(stats.overdue ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" />
          {stats.overdue} overdue
        </span>
      )}
    </div>
  )
}
