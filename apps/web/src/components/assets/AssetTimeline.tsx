import { Wrench, RefreshCw, Zap, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export type TimelineEventType = 'work_order' | 'pm' | 'iot_alert' | 'status_change'

export interface TimelineEvent {
  id: number | string
  type: TimelineEventType
  title: string
  description?: string
  date: string
  meta?: string
}

const EVENT_STYLES: Record<TimelineEventType, { icon: React.ElementType; color: string; bg: string }> = {
  work_order: { icon: Wrench, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  pm: { icon: RefreshCw, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40' },
  iot_alert: { icon: Zap, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  status_change: { icon: Activity, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
}

interface AssetTimelineProps {
  events: TimelineEvent[]
  className?: string
}

export function AssetTimeline({ events, className }: AssetTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
        No history yet.
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)} aria-label="Asset maintenance history">
      {events.map((event, index) => {
        const { icon: Icon, color, bg } = EVENT_STYLES[event.type]
        const isLast = index === events.length - 1

        return (
          <div key={event.id} className="relative flex gap-4 pb-6">
            {/* Vertical connector line */}
            {!isLast && (
              <div className="absolute left-5 top-10 h-full w-px bg-gray-200 dark:bg-gray-700" />
            )}

            {/* Icon */}
            <div className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full', bg)}>
              <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
            </div>

            {/* Content */}
            <div className="flex-1 pt-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</p>
                  {event.description && (
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{event.description}</p>
                  )}
                  {event.meta && (
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{event.meta}</p>
                  )}
                </div>
                <time
                  dateTime={event.date}
                  className="shrink-0 text-xs text-gray-400 dark:text-gray-500"
                >
                  {format(new Date(event.date), 'MMM d, yyyy')}
                </time>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
