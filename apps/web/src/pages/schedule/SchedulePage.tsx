import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { parseISO } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ScheduleGrid } from '@/components/schedule/ScheduleGrid'
import { MoveModal } from '@/components/schedule/MoveModal'
import { OverloadSummary } from '@/components/schedule/OverloadSummary'
import { useReschedule, useSchedule } from '@/hooks/useSchedule'
import { formatDate, weekStartsOn } from '@/lib/localeFormat'
import { moveRequest, rangeFor, step, type ViewMode } from '@/lib/scheduleView'
import type { ScheduledOrder } from '@/types/schedule'

const MODES: ViewMode[] = ['day', 'week']

/** Who is doing what, and when, with the days that hold more than a day's work picked out. Drag work to move it. */
export function SchedulePage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [picked, setPicked] = useState<ScheduledOrder | null>(null)
  const { from, to } = rangeFor(mode, anchor, weekStartsOn())
  const { data: schedule, isLoading, isError } = useSchedule(from, to)
  const reschedule = useReschedule()

  const move = (order: ScheduledOrder, personId: number | null, day: string) => {
    const input = moveRequest(order, personId, day)
    if (input) reschedule.mutate({ id: order.id, input })
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('schedule.title')} description={t('schedule.description')} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setAnchor((a) => step(mode, a, -1))} aria-label={t(`schedule.previous_${mode}`)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>{t('workOrders.due.today')}</Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor((a) => step(mode, a, 1))} aria-label={t(`schedule.next_${mode}`)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {from === to ? formatDate(parseISO(from)) : `${formatDate(parseISO(from))} – ${formatDate(parseISO(to))}`}
          </h2>
        </div>
        <div className="flex gap-1" role="group" aria-label={t('schedule.view')}>
          {MODES.map((id) => (
            <Button key={id} size="sm" variant={mode === id ? 'secondary' : 'ghost'} aria-pressed={mode === id} onClick={() => setMode(id)}>
              {t(`schedule.mode_${id}`)}
            </Button>
          ))}
        </div>
      </div>

      {isError && !schedule && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('schedule.load_failed')}</p>}
      {isLoading && <Skeleton className="h-64 w-full" />}
      {schedule && (
        <>
          <OverloadSummary schedule={schedule} />
          {schedule.truncated && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t('schedule.truncated')}</p>
          )}
          <ScheduleGrid schedule={schedule} mode={mode} onMove={move} onPick={setPicked} />
        </>
      )}

      {picked && schedule && (
        <MoveModal order={picked} schedule={schedule} saving={reschedule.isPending} onClose={() => setPicked(null)}
          onSave={(input) => reschedule.mutate({ id: picked.id, input }, { onSuccess: () => setPicked(null) })} />
      )}
    </div>
  )
}

