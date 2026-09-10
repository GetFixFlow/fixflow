import { useState } from 'react'
import { addDays, format, differenceInCalendarDays, startOfToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { PMForecastItem, Priority } from '@/types'

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-400 text-white',
  medium: 'bg-blue-400 text-white',
  low: 'bg-gray-400 text-white',
}

interface PMForecastTimelineProps { items: PMForecastItem[] }

export function PMForecastTimeline({ items }: PMForecastTimelineProps) {
  const [days, setDays] = useState<30 | 60 | 90>(30)
  const today = startOfToday()
  const endDate = addDays(today, days)

  // Create date header array (show every 3rd day for readability)
  const dateHeaders: Date[] = []
  for (let i = 0; i <= days; i += 3) dateHeaders.push(addDays(today, i))

  // Group items by PM name to show unique rows
  const uniquePMs = Array.from(new Map(items.map((i) => [i.pm_id, i])).values()).slice(0, 12)

  const dueInRange = (item: PMForecastItem) => {
    const d = new Date(item.due_date)
    return d >= today && d <= endDate
  }

  const getLeftPercent = (dateStr: string) => {
    const d = new Date(dateStr)
    const diff = differenceInCalendarDays(d, today)
    return Math.max(0, Math.min(100, (diff / days) * 100))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">PM Schedule Forecast</p>
        <div className="flex gap-1">
          {([30, 60, 90] as const).map((d) => (
            <Button key={d} variant={days === d ? 'default' : 'ghost'} size="sm" onClick={() => setDays(d)}>
              {d} days
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Date header */}
          <div className="relative h-6 border-b border-gray-200 dark:border-gray-700 mb-2">
            {dateHeaders.map((d) => (
              <span
                key={d.toISOString()}
                className="absolute text-xs text-gray-400 transform -translate-x-1/2"
                style={{ left: `${(differenceInCalendarDays(d, today) / days) * 100}%` }}
              >
                {format(d, 'MMM d')}
              </span>
            ))}
          </div>

          {/* PM rows */}
          <div className="space-y-1">
            {uniquePMs.filter(dueInRange).map((item) => (
              <div key={item.pm_id} className="relative h-8 flex items-center">
                <span className="absolute left-0 z-10 text-xs text-gray-600 dark:text-gray-400 w-40 truncate pr-2 bg-white dark:bg-gray-900">
                  {item.pm_name}
                </span>
                <div className="absolute left-40 right-0 h-full">
                  {/* background track */}
                  <div className="absolute inset-y-2 left-0 right-0 bg-gray-100 dark:bg-gray-800 rounded" />
                  {/* due marker */}
                  <div
                    className={cn('absolute top-1 bottom-1 w-4 -translate-x-2 rounded cursor-pointer group', PRIORITY_COLOR[item.priority ?? 'medium'])}
                    style={{ left: `${getLeftPercent(item.due_date)}%` }}
                    title={`${item.pm_name} — ${format(new Date(item.due_date), 'MMM d')}\nAsset: ${item.asset_name}\n${item.estimated_hours ? `Est: ${item.estimated_hours}h` : ''}`}
                  >
                    <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap bg-gray-900 text-white text-xs rounded px-2 py-1 z-50">
                      {format(new Date(item.due_date), 'MMM d')} · {item.asset_name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {uniquePMs.filter(dueInRange).length === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">No PMs due in the next {days} days</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
