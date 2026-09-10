import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'

const COLORS = { operational: '#22c55e', degraded: '#eab308', down: '#ef4444', decommissioned: '#6b7280' }
interface AssetStatus { status: string; count: number }
interface AssetHealthDonutProps { data: AssetStatus[]; healthScore: number; onSegmentClick?: (status: string) => void }

export function AssetHealthDonut({ data, healthScore, onSegmentClick }: AssetHealthDonutProps) {
  const color = healthScore >= 95 ? 'text-green-600' : healthScore >= 80 ? 'text-yellow-600' : 'text-red-500'
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={70} outerRadius={105}
            paddingAngle={2} onClick={(d: AssetStatus) => onSegmentClick?.(d.status)}>
            {data.map((entry, i) => (
              <Cell key={i} fill={COLORS[entry.status as keyof typeof COLORS] ?? '#6b7280'} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number, name: string) => [v, name.charAt(0).toUpperCase() + name.slice(1)]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className={cn('text-3xl font-bold', color)}>{healthScore}%</p>
          <p className="text-xs text-gray-400">health score</p>
        </div>
      </div>
    </div>
  )
}
