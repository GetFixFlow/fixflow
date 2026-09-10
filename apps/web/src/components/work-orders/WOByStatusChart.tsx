import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { WorkOrderStatus } from '@/types'

const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  open: '#3b82f6',
  assigned: '#6366f1',
  in_progress: '#f59e0b',
  on_hold: '#9ca3af',
  pending_parts: '#f97316',
  completed: '#22c55e',
  verified: '#10b981',
  cancelled: '#ef4444',
}

interface WOByStatusChartProps {
  data: Record<string, number>
  onBarClick?: (status: string) => void
}

export function WOByStatusChart({ data, onBarClick }: WOByStatusChartProps) {
  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status: status.replace('_', ' '),
      count,
      key: status,
    }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 10, left: 60, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={80} />
        <Tooltip />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          cursor={onBarClick ? 'pointer' : undefined}
          onClick={(d) => onBarClick?.(d.key)}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.key}
              fill={STATUS_COLORS[entry.key as WorkOrderStatus] ?? '#9ca3af'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
