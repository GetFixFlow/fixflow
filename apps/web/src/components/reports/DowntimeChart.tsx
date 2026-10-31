import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatHours } from '@/utils/chartUtils'
import type { DowntimeRow } from '@/types/reports'

/** The assets that were down for the most hours, longest at the top. */
export function DowntimeChart({ data }: { data: DowntimeRow[] }) {
  const longest = data.filter((row) => row.downtime_hours > 0).sort((a, b) => b.downtime_hours - a.downtime_hours).slice(0, 10)
  if (longest.length === 0) return <p className="py-10 text-center text-sm text-gray-500">No downtime in this period.</p>
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={longest} layout="vertical" margin={{ top: 5, right: 40, bottom: 5, left: 90 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v} h`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={85} />
        <Tooltip formatter={(v) => formatHours(Number(v))} />
        <Bar dataKey="downtime_hours" name="Down for" fill="#ef4444" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
