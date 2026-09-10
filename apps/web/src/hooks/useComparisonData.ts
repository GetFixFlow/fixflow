import { useMemo } from 'react'
import { subDays, differenceInDays } from 'date-fns'
import { useReportStore } from '@/stores/reportStore'
import { percentChange, getTrendDirection, type TrendDirection } from '@/utils/reportUtils'

interface ComparisonResult {
  prevFrom: Date
  prevTo: Date
  change: (current: number, previous: number, metric: string) => {
    value: number
    direction: TrendDirection
    label: string
  }
}

export function useComparisonData(): ComparisonResult {
  const { dateFrom, dateTo } = useReportStore()

  const { prevFrom, prevTo } = useMemo(() => {
    const days = differenceInDays(dateTo, dateFrom)
    return {
      prevFrom: subDays(dateFrom, days + 1),
      prevTo: subDays(dateFrom, 1),
    }
  }, [dateFrom, dateTo])

  const change = (current: number, previous: number, metric: string) => {
    const value = percentChange(current, previous)
    const direction = getTrendDirection(metric, value)
    const label = `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs prev period`
    return { value, direction, label }
  }

  return { prevFrom, prevTo, change }
}
