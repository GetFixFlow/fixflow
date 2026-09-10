// GitHub-style WO completion heatmap (13 weeks × 7 days)
import { cn } from '@/lib/utils'
import { format, startOfWeek, addDays, subWeeks } from 'date-fns'

interface HeatmapCell { date: string; count: number }

function getIntensity(count: number, max: number): number {
  if (max === 0 || count === 0) return 0
  return Math.ceil((count / max) * 4)
}

const INTENSITY_CLASSES = ['bg-gray-100 dark:bg-gray-800', 'bg-blue-100 dark:bg-blue-900/30', 'bg-blue-300 dark:bg-blue-700/50', 'bg-blue-500 dark:bg-blue-600', 'bg-blue-700 dark:bg-blue-500']

export function ResolutionHeatmap({ data }: { data: HeatmapCell[] }) {
  const byDate = new Map(data.map((d) => [d.date, d.count]))
  const max = Math.max(...data.map((d) => d.count), 1)

  const weeks: Date[][] = []
  const today = new Date()
  for (let w = 12; w >= 0; w--) {
    const weekStart = startOfWeek(subWeeks(today, w), { weekStartsOn: 1 })
    weeks.push(Array.from({ length: 7 }, (_, d) => addDays(weekStart, d)))
  }

  const days = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="flex gap-1 min-w-[600px]">
        <div className="flex flex-col gap-1 mr-1">
          {days.map((d, i) => (
            <div key={i} className="h-3 w-6 text-[9px] text-gray-400 flex items-center">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) => {
              const key = format(day, 'yyyy-MM-dd')
              const count = byDate.get(key) ?? 0
              const intensity = getIntensity(count, max)
              return (
                <div key={di} title={`${format(day, 'MMM d')}: ${count} WOs`}
                  className={cn('h-3 w-3 rounded-sm cursor-pointer transition-transform hover:scale-125', INTENSITY_CLASSES[intensity])} />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span>Less</span>
        {INTENSITY_CLASSES.map((cls, i) => (
          <span key={i} className={cn('h-3 w-3 rounded-sm', cls)} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
