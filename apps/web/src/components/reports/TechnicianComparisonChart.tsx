import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface TechMetric { name: string; completed: number; avg_hours: number; overdue: number; first_fix: number }
type MetricKey = 'completed' | 'avg_hours' | 'overdue' | 'first_fix'

export function TechnicianComparisonChart({ data, metric = 'completed' }: { data: TechMetric[]; metric?: MetricKey }) {
  const metaMap: Record<MetricKey, { label: string; color: string }> = {
    completed: { label: 'Completed WOs', color: '#22c55e' },
    avg_hours: { label: 'Avg Resolution (hrs)', color: '#3b82f6' },
    overdue: { label: 'Overdue WOs', color: '#ef4444' },
    first_fix: { label: 'First-Time Fix (%)', color: '#8b5cf6' },
  }
  const { label, color } = metaMap[metric]
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75} />
        <Tooltip />
        <Legend />
        <Bar dataKey={metric} name={label} fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
