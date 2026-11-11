import { currentLanguage } from '@/i18n'
import { useTranslation } from 'react-i18next'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface TrendDataPoint {
  date: string
  created: number
  completed: number
}

interface WOTrendChartProps {
  data: TrendDataPoint[]
}

export function WOTrendChart({ data }: WOTrendChartProps) {
  const { t } = useTranslation()
  const dayFormat = new Intl.DateTimeFormat(currentLanguage(), { month: 'short', day: 'numeric' })
  const formatted = data.map((d) => ({
    ...d,
    label: dayFormat.format(new Date(d.date)),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="created"
          name={t('workOrders.charts.created')}
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="completed"
          name={t('common.status.completed')}
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
