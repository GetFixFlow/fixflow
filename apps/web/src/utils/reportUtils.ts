import { format, differenceInHours, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import type { WorkOrder } from '@/types'

export function calculateCompliance(scheduled: number, completed: number): number {
  if (scheduled === 0) return 100
  return Math.round((completed / scheduled) * 1000) / 10
}

export function calculateMTTR(workOrders: WorkOrder[]): number {
  const completed = workOrders.filter((wo) => wo.completed_at && wo.created_at)
  if (completed.length === 0) return 0
  const totalHours = completed.reduce((sum, wo) => {
    return sum + differenceInHours(new Date(wo.completed_at!), new Date(wo.created_at))
  }, 0)
  return Math.round((totalHours / completed.length) * 10) / 10
}

export function calculateFirstTimeFixRate(workOrders: WorkOrder[]): number {
  const completed = workOrders.filter((wo) => wo.status === 'completed')
  if (completed.length === 0) return 0
  // First-time fix = completed without reopening (no wo_type change or re-open)
  const firstTimeFix = completed.filter((wo) => !(wo as unknown as Record<string, unknown>)['reopened_count'])
  return Math.round((firstTimeFix.length / completed.length) * 1000) / 10
}

export function groupByPeriod<T>(
  data: T[],
  dateField: keyof T,
  period: 'day' | 'week' | 'month',
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of data) {
    const date = new Date(item[dateField] as string)
    let key: string
    if (period === 'day') key = format(startOfDay(date), 'yyyy-MM-dd')
    else if (period === 'week') key = format(startOfWeek(date), 'yyyy-MM-dd')
    else key = format(startOfMonth(date), 'yyyy-MM')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }
  return groups
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export type TrendDirection = 'improved' | 'degraded' | 'neutral'

export function getTrendDirection(
  metric: string,
  change: number,
): TrendDirection {
  if (Math.abs(change) < 0.1) return 'neutral'
  // Metrics where higher = worse
  const higherIsWorse = ['overdue_rate', 'mttr', 'avg_resolution_hours', 'missed_count', 'missed_rate', 'alert_count', 'cost']
  const isWorsening = higherIsWorse.some((k) => metric.toLowerCase().includes(k))
    ? change > 0
    : change < 0
  return isWorsening ? 'degraded' : 'improved'
}
