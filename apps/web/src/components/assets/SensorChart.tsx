import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { SensorReading, SensorType } from '@/types'
import { format } from 'date-fns'

type TimeRange = '1h' | '6h' | '24h' | '7d'

const RANGE_LABELS: TimeRange[] = ['1h', '6h', '24h', '7d']

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed']

interface SensorChartProps {
  readings: SensorReading[]
  sensorTypes?: SensorType[]
  thresholds?: Partial<Record<SensorType, number>>
  className?: string
}

function filterByRange(readings: SensorReading[], range: TimeRange): SensorReading[] {
  const now = Date.now()
  const hours: Record<TimeRange, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 }
  const cutoff = now - hours[range] * 3600000
  return readings.filter((r) => new Date(r.recorded_at).getTime() >= cutoff)
}

export function SensorChart({
  readings,
  sensorTypes,
  thresholds = {},
  className,
}: SensorChartProps) {
  const [range, setRange] = useState<TimeRange>('24h')

  const filtered = filterByRange(readings, range)

  const types = sensorTypes ?? ([...new Set(filtered.map((r) => r.sensor_type))] as SensorType[])

  const chartData = filtered.reduce<Record<string, Record<string, number | string>>>((acc, r) => {
    const key = r.recorded_at
    if (!acc[key]) acc[key] = { time: key }
    acc[key][r.sensor_type] = r.value
    return acc
  }, {})

  const data = Object.values(chartData).sort(
    (a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime(),
  )

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sensor Readings</h3>
          <div className="flex gap-1">
            {RANGE_LABELS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  range === r
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {data.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            No readings in this time range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="time"
                tickFormatter={(v) => format(new Date(v as string), range === '7d' ? 'MMM d' : 'HH:mm')}
                tick={{ fontSize: 11 }}
                className="text-gray-500 dark:text-gray-400"
              />
              <YAxis tick={{ fontSize: 11 }} className="text-gray-500 dark:text-gray-400" />
              <Tooltip
                labelFormatter={(v) => format(new Date(v as string), 'MMM d, HH:mm')}
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg, white)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              {types.map((type, i) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  name={type}
                />
              ))}
              {types.map((type) =>
                thresholds[type] != null ? (
                  <ReferenceLine
                    key={`threshold-${type}`}
                    y={thresholds[type]}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `${type} limit`, fill: '#ef4444', fontSize: 10 }}
                  />
                ) : null,
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
