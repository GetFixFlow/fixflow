import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartTooltip } from './ChartTooltip'

interface PriorityData { priority: string; created: number; completed: number; open: number; avg_hours: number; overdue_pct: number }
export function WOByPriorityChart({ data }: { data: PriorityData[] }) {
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="priority" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Bar dataKey="created" name="Created" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[2, 2, 0, 0]} />
          <Bar dataKey="open" name="Open" fill="#f59e0b" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700">
            <th className="text-left py-1">Priority</th>
            <th className="text-right py-1">Created</th>
            <th className="text-right py-1">Completed</th>
            <th className="text-right py-1">Avg Hours</th>
            <th className="text-right py-1">Overdue %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.priority} className="border-b border-gray-50 dark:border-gray-800">
              <td className="py-1.5 capitalize font-medium">{row.priority}</td>
              <td className="text-right py-1.5">{row.created}</td>
              <td className="text-right py-1.5">{row.completed}</td>
              <td className="text-right py-1.5">{row.avg_hours.toFixed(1)}h</td>
              <td className="text-right py-1.5">{row.overdue_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
