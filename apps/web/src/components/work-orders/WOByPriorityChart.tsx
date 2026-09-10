import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { Priority } from '@/types'

const PRIORITY_COLORS: Record<Priority, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
}

interface WOByPriorityChartProps {
  data: Record<string, number>
}

export function WOByPriorityChart({ data }: WOByPriorityChartProps) {
  const total = Object.values(data).reduce((s, v) => s + v, 0)

  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([priority, count]) => ({
      name: priority.charAt(0).toUpperCase() + priority.slice(1),
      value: count,
      key: priority,
    }))

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.key}
                fill={PRIORITY_COLORS[entry.key as Priority] ?? '#9ca3af'}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center" style={{ marginTop: '-10px' }}>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">total</p>
        </div>
      </div>
    </div>
  )
}
