import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { STATUS_COLORS } from '@/utils/chartUtils'

interface StatusData { status: string; count: number }
interface WOStatusDonutChartProps { data: StatusData[]; onSegmentClick?: (status: string) => void }

export function WOStatusDonutChart({ data, onSegmentClick }: WOStatusDonutChartProps) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className="space-y-3">
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={60} outerRadius={90}
              paddingAngle={2} onClick={(d: StatusData) => onSegmentClick?.(d.status)}>
              {data.map((entry, i) => (
                <Cell key={i} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] ?? '#6b7280'} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, name: string) => [v, name.replace(/_/g, ' ')]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center pointer-events-none">
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
            <p className="text-xs text-gray-400">total</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[d.status as keyof typeof STATUS_COLORS] ?? '#6b7280' }} />
            <span className="text-gray-600 dark:text-gray-400 capitalize">{d.status.replace(/_/g, ' ')}: <strong>{d.count}</strong></span>
          </div>
        ))}
      </div>
    </div>
  )
}
