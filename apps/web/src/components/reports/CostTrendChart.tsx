import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/utils/chartUtils'
import { format } from 'date-fns'
import { formatDate, formatShortMoney } from '@/lib/localeFormat'

interface CostTrendPoint { period: string; labor: number; parts: number; vendor?: number; total: number; wo_count: number }

/** Points are one per day, week (starting that Monday) or month; the label follows the company's date format. */
const label = (period: string, unit?: string) => (unit === 'month' ? format(new Date(`${period}T00:00:00`), 'MMM yyyy') : formatDate(period))

export function CostTrendChart({ data, unit }: { data: CostTrendPoint[]; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 5, right: 40, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={(p) => label(String(p), unit)} minTickGap={24} />
        <YAxis yAxisId="cost" tick={{ fontSize: 10 }} tickFormatter={(v) => formatShortMoney(v, 0)} />
        <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 10 }} />
        <Tooltip labelFormatter={(p) => label(String(p), unit)} formatter={(v, name) => {
          if (name === 'WOs') return [v, name]
          return [formatCurrency(Number(v)), name]
        }} />
        <Legend />
        <Bar yAxisId="cost" dataKey="labor" name="Labor" fill="#3b82f6" stackId="a" />
        <Bar yAxisId="cost" dataKey="parts" name="Parts" fill="#22c55e" stackId="a" />
        <Bar yAxisId="cost" dataKey="vendor" name="Vendors" fill="#8b5cf6" stackId="a" radius={[2, 2, 0, 0]} />
        <Line yAxisId="count" type="monotone" dataKey="wo_count" name="WOs" stroke="#f59e0b" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
