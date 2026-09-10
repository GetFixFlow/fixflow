import { useState } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { cn } from '@/lib/utils'
import { ChartTooltip } from './ChartTooltip'

interface WOTrendDataPoint {
  date: string
  created: number
  completed: number
  resolution_hours: number
}

interface WOTrendChartProps {
  data: WOTrendDataPoint[]
  className?: string
}

type GroupBy = 'day' | 'week' | 'month'

export function WOTrendChart({ data, className }: WOTrendChartProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('week')
  const [show, setShow] = useState({ created: true, completed: true, resolution: true })
  const avg = data.length ? Math.round(data.reduce((s, d) => s + d.resolution_hours, 0) / data.length * 10) / 10 : 0

  const toggleOption = (key: keyof typeof show) => setShow((prev: typeof show) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map((g) => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={cn('px-2 py-1 text-xs rounded capitalize transition-colors',
                groupBy === g ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 hover:bg-gray-200')}>
              {g}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-xs">
          {([['created', 'Created', '#3b82f6'], ['completed', 'Completed', '#22c55e'], ['resolution', 'Resolution', '#f59e0b']] as const).map(([key, label, color]) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={show[key as keyof typeof show]} onChange={() => toggleOption(key as keyof typeof show)} className="sr-only" />
              <span className={cn('h-3 w-3 rounded-sm', !show[key as keyof typeof show] && 'opacity-30')} style={{ background: color }} />
              <span className={cn(!show[key as keyof typeof show] && 'line-through text-gray-400')}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 5, right: 40, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="h" />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          {show.created && <Bar yAxisId="left" dataKey="created" name="Created" fill="#3b82f6" radius={[2, 2, 0, 0]} />}
          {show.completed && <Bar yAxisId="left" dataKey="completed" name="Completed" fill="#22c55e" radius={[2, 2, 0, 0]} />}
          {show.resolution && <Line yAxisId="right" type="monotone" dataKey="resolution_hours" name="Avg Resolution (h)" stroke="#f59e0b" strokeWidth={2} dot={false} />}
          {avg > 0 && <ReferenceLine yAxisId="right" y={avg} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.6} label={{ value: `Avg ${avg}h`, position: 'right', fontSize: 10 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
