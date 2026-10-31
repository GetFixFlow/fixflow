import type { Priority, WorkOrderStatus } from '@/types'

/** A day of the period, and the hours it can hold: none on a day off or a holiday. */
export interface ScheduleDay {
  date: string
  working: boolean
  holiday: string | null
  hours: number
}

/** The work due to one person on one day. */
export interface DayLoad {
  date: string
  count: number
  hours: number
  overloaded: boolean
}

/** Work still open from before the period (or with no date), all of it counted. */
export interface Earlier {
  count: number
  hours: number
}

/** One person's row (`id` and `name` empty for the row of work nobody has). */
export interface ScheduleRow {
  id: number | null
  name: string | null
  role: string | null
  days: DayLoad[]
  earlier: Earlier
}

export interface ScheduledOrder {
  id: number
  work_order_number: string
  title: string
  priority: Priority
  status: WorkOrderStatus
  assignee_id: number | null
  /** The day it is due (YYYY-MM-DD); null when it has no due date. */
  day: string | null
  /** Its estimate; an hour when it has none. */
  hours: number
  estimated: boolean
  asset: string | null
}

export interface Schedule {
  from: string
  to: string
  today: string
  days: ScheduleDay[]
  technicians: ScheduleRow[]
  unassigned: ScheduleRow
  work_orders: ScheduledOrder[]
  /** True when there was more work than is listed. */
  truncated: boolean
}

/** What a move changes: leave a field out to leave it as it is; `assignee_id: null` is "nobody". */
export interface RescheduleInput {
  assignee_id?: number | null
  due_on?: string
}
