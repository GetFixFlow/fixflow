import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/utils/chartUtils'

interface CostTrendPoint { period: string; labor: number; parts: number; total: number; wo_count: number }

export function CostTrendChart({ data }: { data: CostTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 5, right: 40, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="cost" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
        <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number, name: string) => {
          if (name === 'WOs') return [v, name]
          return [formatCurrency(v), name]
        }} />
        <Legend />
        <Bar yAxisId="cost" dataKey="labor" name="Labor" fill="#3b82f6" stackId="a" />
        <Bar yAxisId="cost" dataKey="parts" name="Parts" fill="#22c55e" stackId="a" radius={[2, 2, 0, 0]} />
        <Line yAxisId="count" type="monotone" dataKey="wo_count" name="WOs" stroke="#f59e0b" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
