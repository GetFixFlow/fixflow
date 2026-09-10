import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent } from '@/components/ui/Card'

interface MonthData { month: string; completed: number; missed: number; compliance: number }

export function PMComplianceChart({ data }: { data: MonthData[] }) {
  if (!data || data.length === 0) return null

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Compliance Trend (6 months)</p>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data} barCategoryGap="30%">
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number, name: string) => [v, name === 'completed' ? 'Completed' : 'Missed']}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="completed" stackId="a" radius={[0, 0, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill="#22c55e" />)}
            </Bar>
            <Bar dataKey="missed" stackId="a" radius={[2, 2, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill="#ef4444" />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-1 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-green-500" />Completed</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-500" />Missed</span>
        </div>
      </CardContent>
    </Card>
  )
}
