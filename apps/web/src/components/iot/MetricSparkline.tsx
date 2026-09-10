import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { SensorReading } from '@/types'

interface MetricSparklineProps {
  readings: SensorReading[]
  threshold?: number
  width?: number
  height?: number
}

export function MetricSparkline({ readings, threshold, width = 80, height = 32 }: MetricSparklineProps) {
  if (readings.length < 2) return null
  const last20 = readings.slice(-20).map((r) => ({ v: r.value }))
  const isBreached = threshold != null && (last20.at(-1)?.v ?? 0) > threshold
  return (
    <span style={{ display: 'inline-block', width, height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={last20} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line type="monotone" dataKey="v" stroke={isBreached ? '#ef4444' : '#22c55e'} dot={false} strokeWidth={1.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </span>
  )
}
