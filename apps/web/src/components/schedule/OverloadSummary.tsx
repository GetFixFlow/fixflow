import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { dayHeading, hoursLabel, overloads } from '@/lib/scheduleView'
import type { Schedule } from '@/types/schedule'

/** Who has more than a day's work, and when: the list the grid's red days add up to. */
export function OverloadSummary({ schedule }: { schedule: Schedule }) {
  const list = overloads(schedule)

  if (list.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Nobody has more than a day's work in this period.
      </p>
    )
  }

  return (
    <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-900/20 dark:text-red-200">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {list.length === 1 ? 'One day is overloaded' : `${list.length} days are overloaded`}
      </p>
      <ul className="mt-1 list-inside list-disc">
        {list.map((item) => (
          <li key={`${item.id}-${item.date}`}>
            {item.name}, {dayHeading(item.date, false)}: {hoursLabel(item.hours)} of {item.capacity === 0 ? 'a day off' : hoursLabel(item.capacity)}
          </li>
        ))}
      </ul>
    </div>
  )
}
