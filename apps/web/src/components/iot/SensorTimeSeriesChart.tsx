import { useState, useMemo } from 'react'
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, subHours } from 'date-fns'
import { cn } from '@/lib/utils'
import type { SensorReading } from '@/types'
import type { IoTOperator } from '@/types'

type Range = '1h' | '6h' | '24h' | '7d' | '30d'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

interface MetricConfig {
  name: string
  unit?: string
  threshold?: number
  operator?: IoTOperator
  readings: SensorReading[]
}

interface SensorTimeSeriesChartProps {
  metrics: MetricConfig[]
  className?: string
}

const RANGES: { key: Range; label: string; hours: number }[] = [
  { key: '1h', label: '1h', hours: 1 }, { key: '6h', label: '6h', hours: 6 },
  { key: '24h', label: '24h', hours: 24 }, { key: '7d', label: '7d', hours: 168 },
  { key: '30d', label: '30d', hours: 720 },
]

export function SensorTimeSeriesChart({ metrics, className }: SensorTimeSeriesChartProps) {
  const [range, setRange] = useState<Range>('24h')
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(metrics.map((m) => m.name)))

  const rangeConfig = RANGES.find((r) => r.key === range) ?? RANGES[2]
  const cutoff = subHours(new Date(), rangeConfig.hours)

  const chartData = useMemo(() => {
    const allTimes = new Set<string>()
    const byTime: Record<string, Record<string, number>> = {}

    for (const metric of metrics) {
      if (!activeMetrics.has(metric.name)) continue
      for (const r of metric.readings) {
        if (new Date(r.recorded_at) < cutoff) continue
        const t = r.recorded_at
        allTimes.add(t)
        if (!byTime[t]) byTime[t] = {}
        byTime[t][metric.name] = r.value
      }
    }

    return [...allTimes].sort().map((t) => ({
      time: format(new Date(t), rangeConfig.hours <= 6 ? 'HH:mm' : rangeConfig.hours <= 24 ? 'HH:mm' : 'MM/dd HH:mm'),
      ...byTime[t],
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, activeMetrics, range])

  const toggleMetric = (name: string) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-2 flex-wrap">
          {metrics.map((m, i) => (
            <button key={m.name} onClick={() => toggleMetric(m.name)}
              className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition-all',
                activeMetrics.has(m.name) ? 'text-white border-transparent' : 'border-gray-300 text-gray-500')}
              style={activeMetrics.has(m.name) ? { background: COLORS[i % COLORS.length] } : {}}>
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="capitalize">{m.name}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={cn('px-2 py-1 text-xs rounded transition-colors',
                range === r.key ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 hover:bg-gray-200')}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: '12px' }} />
          <Legend />
          {metrics.map((m, i) => {
            if (!activeMetrics.has(m.name)) return null
            return (
              <Line key={m.name} type="monotone" dataKey={m.name} stroke={COLORS[i % COLORS.length]}
                dot={false} strokeWidth={2} isAnimationActive={false} />
            )
          })}
          {metrics.filter((m) => m.threshold != null && activeMetrics.has(m.name)).map((m, i) => (
            <ReferenceLine key={`threshold-${m.name}`} y={m.threshold} stroke={COLORS[i % COLORS.length]}
              strokeDasharray="4 2" strokeOpacity={0.7} label={{ value: `${m.threshold} ${m.unit ?? ''}`, position: 'right', fontSize: 10 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
