import { cn } from '@/lib/utils'
import { formatHours, formatPercent } from '@/utils/chartUtils'

export interface TechnicianStats {
  user_id: number
  name: string
  assigned: number
  completed: number
  completion_rate: number
  avg_resolution_hours: number
  on_time_rate: number
  first_time_fix_rate: number
  critical_completed: number
}

interface TechnicianScorecardProps {
  stats: TechnicianStats
  onClick?: () => void
  selected?: boolean
}

export function TechnicianScorecard({ stats, onClick, selected }: TechnicianScorecardProps) {
  return (
    <div onClick={onClick} className={cn(
      'rounded-lg border p-4 transition-all',
      onClick && 'cursor-pointer hover:shadow-md',
      selected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
    )}>
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-800 flex items-center justify-center text-sm font-bold text-brand-700">
          {stats.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{stats.name}</p>
          <p className="text-xs text-gray-500">{stats.completed}/{stats.assigned} WOs completed</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-gray-400">Completion</dt>
          <dd className={cn('font-bold text-sm', stats.completion_rate >= 90 ? 'text-green-600' : stats.completion_rate >= 70 ? 'text-amber-600' : 'text-red-500')}>{formatPercent(stats.completion_rate)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Avg Resolution</dt>
          <dd className="font-bold text-sm">{formatHours(stats.avg_resolution_hours)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">First-time Fix</dt>
          <dd className="font-bold text-sm">{formatPercent(stats.first_time_fix_rate)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">On-Time Rate</dt>
          <dd className={cn('font-bold text-sm', stats.on_time_rate < 70 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100')}>{formatPercent(stats.on_time_rate)}</dd>
        </div>
      </dl>
    </div>
  )
}
