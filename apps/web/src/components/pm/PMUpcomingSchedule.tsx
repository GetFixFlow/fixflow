import { Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePreviewSchedule } from '@/hooks/usePreventiveMaintenance'
import { cn } from '@/lib/utils'

export function PMUpcomingSchedule({ pmId }: { pmId: number }) {
  const { data, isLoading } = usePreviewSchedule(pmId)
  const items = data?.items?.slice(0, 6) ?? []

  if (isLoading) return (
    <Card>
      <CardContent className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
      </CardContent>
    </Card>
  )

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" /> Upcoming Schedule
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No upcoming dates</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, idx) => {
              const diff = item.days_until
              const isNext = idx === 0
              return (
                <li key={item.occurrence} className={cn('flex items-center justify-between text-sm', isNext && 'font-medium')}>
                  <span className="text-gray-700 dark:text-gray-300">{format(new Date(item.date), 'MMM d, yyyy')}</span>
                  <span className={cn('text-xs',
                    diff < 0 ? 'text-red-500' :
                    diff === 0 ? 'text-orange-500 font-semibold' :
                    diff <= 7 ? 'text-blue-500' : 'text-gray-400'
                  )}>
                    {diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Today' : `in ${diff}d`}
                    {isNext && <span className="ml-1">← next</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
