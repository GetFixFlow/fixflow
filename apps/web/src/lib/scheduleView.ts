import { addDays, endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
import type { RescheduleInput, Schedule, ScheduledOrder } from '@/types/schedule'

export type ViewMode = 'day' | 'week'

/** The column of work from before the period (or with no date). */
export const EARLIER = 'earlier'

export const toDay = (date: Date) => format(date, 'yyyy-MM-dd')

/** The first and last day shown for a day or week around `anchor`. */
export function rangeFor(mode: ViewMode, anchor: Date, weekStartsOn: 0 | 1): { from: string; to: string } {
  if (mode === 'day') return { from: toDay(anchor), to: toDay(anchor) }
  return { from: toDay(startOfWeek(anchor, { weekStartsOn })), to: toDay(endOfWeek(anchor, { weekStartsOn })) }
}

export const step = (mode: ViewMode, anchor: Date, direction: 1 | -1) => addDays(anchor, direction * (mode === 'day' ? 1 : 7))

/** The work of one person (null: work nobody has) on a day, or in the EARLIER column. */
export function ordersIn(schedule: Schedule, personId: number | null, day: string): ScheduledOrder[] {
  return schedule.work_orders.filter((order) => {
    if (order.assignee_id !== personId) return false
    const earlier = order.day === null || order.day < schedule.from
    return day === EARLIER ? earlier : !earlier && order.day === day
  })
}

/** What dropping `order` on someone's day changes, or null when it is already there. The EARLIER column keeps the date. */
export function moveRequest(order: ScheduledOrder, personId: number | null, day: string): RescheduleInput | null {
  const input: RescheduleInput = {}
  if (personId !== order.assignee_id) input.assignee_id = personId
  if (day !== EARLIER && day !== order.day) input.due_on = day
  return Object.keys(input).length > 0 ? input : null
}

export interface Overload {
  id: number
  name: string
  date: string
  hours: number
  capacity: number
}

/** Every day on which someone has more than a day's work, in order of person and day. */
export function overloads(schedule: Schedule): Overload[] {
  const capacity = new Map(schedule.days.map((day) => [day.date, day.hours]))
  return schedule.technicians.flatMap((person) =>
    person.days
      .filter((day) => day.overloaded)
      .map((day) => ({ id: person.id!, name: person.name!, date: day.date, hours: day.hours, capacity: capacity.get(day.date) ?? 0 })),
  )
}

/** A date such as 2026-10-14 as "Wed 14", for a column heading. */
export const dayHeading = (date: string, wide: boolean) => format(parseISO(date), wide ? 'EEEE d MMMM' : 'EEE d')

export const hoursLabel = (hours: number) => `${Math.round(hours * 10) / 10} h`
