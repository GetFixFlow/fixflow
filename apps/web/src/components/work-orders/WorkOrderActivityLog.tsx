import { Wrench, RefreshCw, Zap, Activity, UserCheck, CheckCircle, ShieldCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

export type ActivityEventType =
  | 'created'
  | 'assigned'
  | 'started'
  | 'completed'
  | 'verified'
  | 'rejected'
  | 'on_hold'
  | 'resumed'
  | 'cancelled'
  | 'comment_added'

export interface ActivityEvent {
  id: number | string
  type: ActivityEventType
  description: string
  actor_name: string
  created_at: string
}

const EVENT_ICON: Record<ActivityEventType, React.ElementType> = {
  created: Wrench,
  assigned: UserCheck,
  started: Activity,
  completed: CheckCircle,
  verified: ShieldCheck,
  rejected: RefreshCw,
  on_hold: Zap,
  resumed: Activity,
  cancelled: Zap,
  comment_added: Wrench,
}

const EVENT_COLOR: Record<ActivityEventType, string> = {
  created: 'bg-gray-400',
  assigned: 'bg-blue-400',
  started: 'bg-yellow-400',
  completed: 'bg-green-500',
  verified: 'bg-green-600',
  rejected: 'bg-orange-400',
  on_hold: 'bg-gray-400',
  resumed: 'bg-yellow-400',
  cancelled: 'bg-red-400',
  comment_added: 'bg-gray-300',
}

interface WorkOrderActivityLogProps {
  events: ActivityEvent[]
  compact?: boolean
}

export function WorkOrderActivityLog({ events, compact = false }: WorkOrderActivityLogProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm italic text-gray-400 dark:text-gray-500">No activity yet.</p>
    )
  }

  return (
    <ol className="relative space-y-3 border-l border-gray-200 pl-4 dark:border-gray-700">
      {events.map((event) => {
        const Icon = EVENT_ICON[event.type] ?? Activity
        const dotColor = EVENT_COLOR[event.type] ?? 'bg-gray-400'

        return (
          <li key={event.id} className="relative">
            <div
              className={cn(
                'absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full',
                dotColor,
              )}
            >
              <Icon className="h-2.5 w-2.5 text-white" />
            </div>
            <div>
              <p className={cn('text-gray-800 dark:text-gray-200', compact ? 'text-xs' : 'text-sm')}>
                <span className="font-medium">{event.actor_name}</span> {event.description}
              </p>
              <time className="text-xs text-gray-400 dark:text-gray-500">
                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
