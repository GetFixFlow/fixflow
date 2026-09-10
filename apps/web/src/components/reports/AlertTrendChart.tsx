import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AlertTrendPoint { period: string; critical: number; high: number; medium: number; low: number; auto_resolved: number }

export function AlertTrendChart({ data }: { data: AlertTrendPoint[] }) {
  const [stacked, setStacked] = useState(true)
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setStacked(!stacked)} className="text-xs text-gray-500 underline">
          {stacked ? 'Unstacked' : 'Stacked'}
        </button>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend />
          {(['critical', 'high', 'medium', 'low'] as const).map((s, i) => {
            const fills = ['#ef4444', '#f97316', '#eab308', '#3b82f6']
            return (
              <Area key={s} type="monotone" dataKey={s} name={s.charAt(0).toUpperCase() + s.slice(1)}
                fill={fills[i]} stroke={fills[i]} fillOpacity={stacked ? 0.5 : 0.2}
                stackId={stacked ? 'a' : undefined} />
            )
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
