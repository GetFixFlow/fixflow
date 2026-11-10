import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { dayHeading, hoursLabel, overloads } from '@/lib/scheduleView'
import type { Schedule } from '@/types/schedule'

/** Who has more than a day's work, and when: the list the grid's red days add up to. */
export function OverloadSummary({ schedule }: { schedule: Schedule }) {
  const { t } = useTranslation()
  const list = overloads(schedule)

  if (list.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> {t('schedule.overload.none')}
      </p>
    )
  }

  return (
    <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-900/20 dark:text-red-200">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {t('schedule.overload.count', { count: list.length })}
      </p>
      <ul className="mt-1 list-inside list-disc">
        {list.map((item) => (
          <li key={`${item.id}-${item.date}`}>
            {t('schedule.overload.item', { name: item.name, day: dayHeading(item.date, false), hours: hoursLabel(item.hours), capacity: item.capacity === 0 ? t('schedule.overload.day_off') : hoursLabel(item.capacity) })}
          </li>
        ))}
      </ul>
    </div>
  )
}
