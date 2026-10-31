import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayHeading, EARLIER, hoursLabel, ordersIn, type ViewMode } from '@/lib/scheduleView'
import type { Priority } from '@/types'
import type { DayLoad, Schedule, ScheduleDay, ScheduleRow, ScheduledOrder } from '@/types/schedule'

const PRIORITY_DOT: Record<Priority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
}

interface ScheduleGridProps {
  schedule: Schedule
  mode: ViewMode
  /** A work order was dropped on a person's day (`day` is EARLIER for the column of work from before). */
  onMove: (order: ScheduledOrder, personId: number | null, day: string) => void
  /** The Move button of a work order: for those who cannot drag. */
  onPick: (order: ScheduledOrder) => void
}

function Chip({ order, detailed, onDragStart, onDragEnd, onPick }: {
  order: ScheduledOrder
  detailed: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onPick: () => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(order.id)); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-md border border-gray-200 bg-white p-1.5 shadow-sm active:cursor-grabbing dark:border-gray-600 dark:bg-gray-700"
    >
      <div className="flex items-start gap-1.5">
        <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', PRIORITY_DOT[order.priority])} aria-hidden />
        <div className="min-w-0 flex-1">
          <Link to={`/work-orders/${order.id}`} className="block truncate text-xs font-medium text-gray-900 hover:underline dark:text-gray-100">
            <span className="sr-only">{order.priority} priority: </span>{order.work_order_number} {order.title}
          </Link>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {hoursLabel(order.hours)}{order.estimated ? '' : ' (no estimate)'}
            {detailed && ` · ${order.status.replace('_', ' ')}`}
            {detailed && order.asset && ` · ${order.asset}`}
          </p>
        </div>
        <button type="button" onClick={onPick} aria-label={`Move ${order.work_order_number}`}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-200">
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** How full a day is: the hours against what the day holds, and in words when it is too many. */
function Load({ load, day }: { load: DayLoad; day: ScheduleDay }) {
  if (load.count === 0 && !load.overloaded) return null
  const over = load.hours - day.hours
  return (
    <div className="mt-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-600" aria-hidden>
        <div className={cn('h-full', load.overloaded ? 'bg-red-500' : 'bg-brand-500')}
          style={{ width: `${day.hours > 0 ? Math.min(100, (load.hours / day.hours) * 100) : 100}%` }} />
      </div>
      <p className={cn('mt-0.5 flex items-center gap-1 text-[11px]', load.overloaded ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400')}>
        {load.overloaded && <AlertTriangle className="h-3 w-3" aria-hidden />}
        {hoursLabel(load.hours)} of {hoursLabel(day.hours)}
        {load.overloaded && (day.hours === 0 ? ' · day off' : ` · over by ${hoursLabel(over)}`)}
      </p>
    </div>
  )
}

export function ScheduleGrid({ schedule, mode, onMove, onPick }: ScheduleGridProps) {
  const [dragging, setDragging] = useState<ScheduledOrder | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const detailed = mode === 'day'
  const rows: ScheduleRow[] = [schedule.unassigned, ...schedule.technicians]

  const cell = (row: ScheduleRow, day: string) => ({
    onDragOver: (e: React.DragEvent) => { if (dragging) { e.preventDefault(); setOver(`${row.id}:${day}`) } },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setOver(null)
      if (dragging) onMove(dragging, row.id, day)
      setDragging(null)
    },
  })

  const chips = (row: ScheduleRow, day: string) =>
    ordersIn(schedule, row.id, day).map((order) => (
      <Chip key={order.id} order={order} detailed={detailed} onDragStart={() => setDragging(order)}
        onDragEnd={() => { setDragging(null); setOver(null) }} onPick={() => onPick(order)} />
    ))

  const tint = (key: string) => (over === key ? 'bg-brand-50 ring-2 ring-inset ring-brand-400 dark:bg-brand-900/20' : '')

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/60">
            <th scope="col" className="sticky left-0 z-10 w-40 bg-gray-50 p-2 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">Technician</th>
            <th scope="col" className="w-36 p-2 text-xs font-medium text-gray-500 dark:text-gray-400">Earlier or no date</th>
            {schedule.days.map((day) => (
              <th key={day.date} scope="col" className={cn('min-w-36 p-2 text-xs font-medium', day.date === schedule.today ? 'text-brand-700 dark:text-brand-300' : 'text-gray-500 dark:text-gray-400')}>
                {dayHeading(day.date, detailed)}
                {day.date === schedule.today && ' · today'}
                {!day.working && <span className="block font-normal">{day.holiday ?? 'Day off'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const nobody = row.id === null
            const earlierShown = ordersIn(schedule, row.id, EARLIER).length
            return (
              <tr key={row.id ?? 'nobody'} className="border-t border-gray-200 align-top dark:border-gray-700">
                <th scope="row" className="sticky left-0 z-10 bg-white p-2 text-sm font-medium text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                  {nobody ? 'Nobody yet' : row.name}
                  {!nobody && row.role !== 'technician' && <span className="block text-xs font-normal capitalize text-gray-500">{row.role}</span>}
                </th>
                <td className={cn('p-1.5', tint(`${row.id}:${EARLIER}`))} data-testid={`cell-${row.id ?? 'nobody'}-${EARLIER}`} {...cell(row, EARLIER)}>
                  {row.earlier.count > 0 && (
                    <p className="mb-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      {row.earlier.count} open · {hoursLabel(row.earlier.hours)}
                    </p>
                  )}
                  <div className="space-y-1">{chips(row, EARLIER)}</div>
                  {row.earlier.count > earlierShown && (
                    <p className="mt-1 text-[11px] text-gray-500">+{row.earlier.count - earlierShown} more, not listed</p>
                  )}
                </td>
                {row.days.map((load, i) => (
                  <td key={load.date} className={cn('p-1.5', !schedule.days[i].working && 'bg-gray-50 dark:bg-gray-800/40', tint(`${row.id}:${load.date}`))}
                    data-testid={`cell-${row.id ?? 'nobody'}-${load.date}`} {...cell(row, load.date)}>
                    <div className="space-y-1">{chips(row, load.date)}</div>
                    {!nobody && <Load load={load} day={schedule.days[i]} />}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
