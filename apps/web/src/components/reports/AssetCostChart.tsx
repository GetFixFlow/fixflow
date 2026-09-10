import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency } from '@/utils/chartUtils'

interface AssetCost { asset_name: string; labor_cost: number; parts_cost: number; total_cost: number; wo_count: number }

export function AssetCostChart({ data, avgCost }: { data: AssetCost[]; avgCost: number }) {
  const top10 = data.slice(0, 10)
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={top10} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 90 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${(v/1000).toFixed(1)}k`} />
          <YAxis type="category" dataKey="asset_name" tick={{ fontSize: 10 }} width={85} />
          <Tooltip formatter={(v: number | string) => [formatCurrency(Number(v))]} />
          <Legend />
          <Bar dataKey="labor_cost" name="Labor" fill="#3b82f6" stackId="a" />
          <Bar dataKey="parts_cost" name="Parts" fill="#22c55e" stackId="a" radius={[0, 4, 4, 0]} />
          {avgCost > 0 && <ReferenceLine x={avgCost} stroke="#6b7280" strokeDasharray="4 2" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
