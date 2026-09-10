import { useState } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { cn } from '@/lib/utils'

interface PMCompliancePoint { period: string; scheduled: number; completed: number; missed: number; compliance_rate: number }
interface PMComplianceTrendChartProps { data: PMCompliancePoint[]; target?: number }

export function PMComplianceTrendChart({ data, target = 95 }: PMComplianceTrendChartProps) {
  const [view, setView] = useState<'count' | 'rate'>('rate')

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-1">
        {(['rate', 'count'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn('px-2.5 py-1 text-xs rounded capitalize', view === v ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600')}>
            {v === 'rate' ? 'Compliance %' : 'WO Count'}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        {view === 'rate' ? (
          <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, 'Compliance']} />
            <Line type="monotone" dataKey="compliance_rate" name="Compliance %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            <ReferenceLine y={target} stroke="#ef4444" strokeDasharray="5 3" label={{ value: `Target ${target}%`, position: 'right', fontSize: 10 }} />
          </ComposedChart>
        ) : (
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="completed" name="Completed" fill="#22c55e" stackId="a" />
            <Bar dataKey="missed" name="Missed" fill="#ef4444" stackId="a" radius={[2, 2, 0, 0]} />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
