import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth } from 'date-fns'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatHours(value: number): string {
  if (value < 1) return `${Math.round(value * 60)} min`
  return `${value.toFixed(1)} hrs`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    operational: '#22c55e', degraded: '#eab308', down: '#ef4444',
    decommissioned: '#6b7280', open: '#3b82f6', in_progress: '#f59e0b',
    completed: '#22c55e', cancelled: '#6b7280', on_hold: '#f97316', pending_parts: '#8b5cf6',
  }
  return map[status] ?? '#6b7280'
}

export function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6',
  }
  return map[priority] ?? '#6b7280'
}

export type DateInterval = 'day' | 'week' | 'month'

export function generateDateSeries(from: Date, to: Date, interval: DateInterval): string[] {
  if (interval === 'day') {
    return eachDayOfInterval({ start: from, end: to }).map((d: Date) => format(d, 'yyyy-MM-dd'))
  }
  if (interval === 'week') {
    return eachWeekOfInterval({ start: from, end: to }).map((d: Date) => format(startOfWeek(d), 'yyyy-MM-dd'))
  }
  return eachMonthOfInterval({ start: from, end: to }).map((d: Date) => format(startOfMonth(d), 'yyyy-MM'))
}

export function fillDateGaps<T extends { date: string }>(
  data: T[],
  from: Date,
  to: Date,
  interval: DateInterval,
  defaults: Omit<T, 'date'>,
): T[] {
  const series = generateDateSeries(from, to, interval)
  const byDate = new Map(data.map((d) => [d.date.slice(0, interval === 'month' ? 7 : 10), d]))
  return series.map((d) => byDate.get(d) ?? ({ date: d, ...defaults } as T))
}

export const CHART_COLORS = {
  blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b',
  red: '#ef4444', purple: '#8b5cf6', orange: '#f97316',
  teal: '#14b8a6', pink: '#ec4899', gray: '#6b7280',
}

export const PRIORITY_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6',
}

export const STATUS_COLORS = {
  open: '#3b82f6', in_progress: '#f59e0b', completed: '#22c55e',
  cancelled: '#6b7280', on_hold: '#f97316', pending_parts: '#8b5cf6',
}
