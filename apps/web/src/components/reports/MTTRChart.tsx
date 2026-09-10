import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'

type GroupBy = 'asset' | 'location' | 'technician'
interface MTTRDataPoint { name: string; avg_hours: number; wo_count: number; min_hours: number; max_hours: number }

export function MTTRChart({ data, overall_avg }: { data: Record<GroupBy, MTTRDataPoint[]>; overall_avg: number }) {
  const [groupBy, setGroupBy] = useState<GroupBy>('asset')
  const current: MTTRDataPoint[] = (data as Record<string, MTTRDataPoint[]>)[groupBy] ?? []

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['asset', 'location', 'technician'] as const).map((g) => (
          <button key={g} onClick={() => setGroupBy(g)}
            className={`px-2 py-1 text-xs rounded capitalize ${groupBy === g ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            By {g}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={current.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75} />
          <Tooltip formatter={(v: number | string) => [`${Number(v).toFixed(1)} hrs`, 'Avg MTTR']} />
          <Bar dataKey="avg_hours" name="Avg MTTR" radius={[0, 4, 4, 0]}>
            {current.slice(0, 10).map((entry: MTTRDataPoint, i: number) => (
              <Cell key={i} fill={entry.avg_hours < 4 ? '#22c55e' : entry.avg_hours < 8 ? '#eab308' : '#ef4444'} />
            ))}
          </Bar>
          {overall_avg > 0 && <ReferenceLine x={overall_avg} stroke="#6b7280" strokeDasharray="4 2" label={{ value: `Avg ${overall_avg}h`, position: 'top', fontSize: 10 }} />}
        </BarChart>
      </ResponsiveContainer>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th className="text-left py-1 capitalize">{groupBy}</th>
              <th className="text-right py-1">WOs</th>
              <th className="text-right py-1">Avg Hrs</th>
              <th className="text-right py-1">Min</th>
              <th className="text-right py-1">Max</th>
            </tr>
          </thead>
          <tbody>
            {current.slice(0, 10).map((row: MTTRDataPoint) => (
              <tr key={row.name} className="border-b border-gray-50 dark:border-gray-800">
                <td className="py-1.5 font-medium">{row.name}</td>
                <td className="text-right">{row.wo_count}</td>
                <td className="text-right">{row.avg_hours.toFixed(1)}h</td>
                <td className="text-right">{row.min_hours.toFixed(1)}h</td>
                <td className="text-right">{row.max_hours.toFixed(1)}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
