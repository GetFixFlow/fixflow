import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PRIORITY_COLORS } from '@/utils/chartUtils'

interface AgingDataPoint { bucket: string; critical: number; high: number; medium: number; low: number }
interface OldestWO { id: number; work_order_number: string; title: string; asset_name: string; priority: string; days_open: number; assignee_name?: string }

interface BacklogAgingChartProps { data: AgingDataPoint[]; oldestWOs: OldestWO[] }

export function BacklogAgingChart({ data, oldestWOs }: BacklogAgingChartProps) {
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend />
          {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
            <Bar key={p} dataKey={p} name={p.charAt(0).toUpperCase() + p.slice(1)} fill={PRIORITY_COLORS[p]} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {oldestWOs.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th className="text-left py-1">WO #</th>
              <th className="text-left py-1">Title</th>
              <th className="text-left py-1">Asset</th>
              <th className="text-right py-1">Days Open</th>
            </tr>
          </thead>
          <tbody>
            {oldestWOs.map((wo) => (
              <tr key={wo.id} className="border-b border-gray-50 dark:border-gray-800">
                <td className="py-1.5 font-mono">{wo.work_order_number}</td>
                <td className="py-1.5 truncate max-w-[120px]">{wo.title}</td>
                <td className="py-1.5 text-gray-500">{wo.asset_name}</td>
                <td className="py-1.5 text-right font-medium text-red-600">{wo.days_open}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
