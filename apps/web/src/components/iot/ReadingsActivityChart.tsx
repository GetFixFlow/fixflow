import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'
import { cn } from '@/lib/utils'

type Range = '1h' | '6h' | '24h' | '7d'

interface ReadingPoint { hour: string; count: number; alerts?: number }

interface ReadingsActivityChartProps {
  data: ReadingPoint[]
  isLoading?: boolean
}

const RANGES: { key: Range; label: string }[] = [
  { key: '1h', label: '1h' }, { key: '6h', label: '6h' },
  { key: '24h', label: '24h' }, { key: '7d', label: '7d' },
]

export function ReadingsActivityChart({ data, isLoading }: ReadingsActivityChartProps) {
  const [range, setRange] = useState<Range>('24h')

  const sliceCount = range === '1h' ? 1 : range === '6h' ? 6 : range === '7d' ? 168 : 24
  const sliced = data.slice(-sliceCount)

  const alertPoints = sliced.filter((d) => (d.alerts ?? 0) > 0)

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Readings Activity</p>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={cn('px-2 py-1 text-xs rounded transition-colors',
                range === r.key ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200')}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={sliced} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="readingGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: '12px' }} />
          <Area type="monotone" dataKey="count" name="Readings" stroke="#3b82f6" fill="url(#readingGrad)" strokeWidth={2} />
          {alertPoints.map((pt, i) => (
            <ReferenceDot key={i} x={pt.hour} y={0} r={4} fill="#ef4444" stroke="none" />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
