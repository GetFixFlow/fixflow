import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CHART_COLORS } from '@/utils/chartUtils'

interface SensorSeries { metric: string; unit: string; data: { time: string; value: number }[] }

export function SensorTrendComparison({ series }: { series: SensorSeries[] }) {
  // Merge all series by time into one array
  const allTimes = [...new Set(series.flatMap((s) => s.data.map((d) => d.time)))].sort()
  const merged = allTimes.map((time) => {
    const row: Record<string, unknown> = { time }
    for (const s of series) {
      const point = s.data.find((d) => d.time === time)
      row[s.metric] = point?.value ?? null
    }
    return row
  })

  const colorKeys = Object.keys(CHART_COLORS) as (keyof typeof CHART_COLORS)[]

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={merged} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="time" tick={{ fontSize: 9 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Legend />
        {series.map((s, i) => (
          <Line key={s.metric} type="monotone" dataKey={s.metric} name={`${s.metric} (${s.unit})`}
            stroke={CHART_COLORS[colorKeys[i % colorKeys.length]]} dot={false} strokeWidth={1.5} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
