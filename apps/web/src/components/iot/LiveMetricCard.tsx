import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LiveReadingBadge } from './LiveReadingBadge'
import type { SensorReading } from '@/types'
import type { IoTOperator } from '@/types'

const METRIC_ICONS: Record<string, string> = {
  temperature: '🌡',
  vibration: '⚡',
  pressure: '💧',
  humidity: '💦',
  current: '⚡',
  voltage: '🔋',
  rpm: '🔄',
}

interface LiveMetricCardProps {
  metricName: string
  unit?: string
  readings: SensorReading[]
  threshold?: number
  operator?: IoTOperator
  className?: string
}

function checkBreached(value: number, threshold: number, operator: IoTOperator): boolean {
  switch (operator) {
    case 'gt': return value > threshold
    case 'gte': return value >= threshold
    case 'lt': return value < threshold
    case 'lte': return value <= threshold
    case 'eq': return value === threshold
    default: return false
  }
}

function formatOperator(op: IoTOperator): string {
  const MAP: Record<IoTOperator, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=', outside_range: '≠' }
  return MAP[op] ?? op
}

export function LiveMetricCard({ metricName, unit, readings, threshold, operator = 'gt', className }: LiveMetricCardProps) {
  const latest = readings.at(-1)
  const value = latest?.value
  const isStale = !latest || Date.now() - new Date(latest.recorded_at).getTime() > 5 * 60 * 1000
  const isVeryStale = !latest || Date.now() - new Date(latest.recorded_at).getTime() > 60 * 60 * 1000
  const isBreached = value != null && threshold != null && checkBreached(value, threshold, operator)
  const isWarning = value != null && threshold != null && !isBreached &&
    checkBreached(value, threshold * 0.8, operator)
  const pct = value != null && threshold != null ? Math.min(100, Math.round((value / threshold) * 100)) : null

  const prevValueRef = useRef<number | undefined>(undefined)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (value !== prevValueRef.current && prevValueRef.current !== undefined) {
      setFlash(true); setTimeout(() => setFlash(false), 600)
    }
    prevValueRef.current = value
  }, [value])

  const icon = METRIC_ICONS[metricName.toLowerCase()] ?? '📡'

  return (
    <div className={cn('rounded-xl border p-4 space-y-3 transition-all duration-300',
      isBreached ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 animate-pulse shadow-red-100 dark:shadow-none shadow' :
      isWarning ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20' :
      isStale ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900' :
      'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
      className)}>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 capitalize">
            {metricName.replace(/_/g, ' ')}
          </span>
        </div>
        {isBreached && <AlertTriangle className="h-4 w-4 text-red-500" />}
      </div>

      <div className={cn('text-3xl font-bold transition-colors duration-200',
        flash && 'text-blue-600 dark:text-blue-400',
        isBreached ? 'text-red-600 dark:text-red-400' :
        isWarning ? 'text-yellow-600 dark:text-yellow-400' :
        isStale ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100')}>
        {isVeryStale ? '—' : value != null ? `${value}` : '—'}
        {value != null && unit && <span className="text-lg font-medium ml-1 text-gray-500">{unit}</span>}
      </div>

      {threshold != null && (
        <>
          <p className="text-xs text-gray-500">Threshold: {formatOperator(operator)} {threshold} {unit}</p>
          {pct != null && (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div className={cn('h-full rounded-full transition-all duration-500',
                  pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500')}
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 text-right">{pct}% of limit</p>
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-medium',
          isBreached ? 'text-red-600' : isWarning ? 'text-yellow-600' : isStale ? 'text-orange-500' : 'text-green-600')}>
          {isVeryStale ? '⚠️ Sensor may be offline' : isStale ? '⚠️ No data (5+ min)' : isBreached ? '🔴 Threshold breached' : isWarning ? '🟡 Near threshold' : threshold != null ? '✓ Normal' : 'No threshold set'}
        </span>
        {latest && <LiveReadingBadge lastReadingAt={latest.recorded_at} />}
      </div>
    </div>
  )
}
