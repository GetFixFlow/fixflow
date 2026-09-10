import { Thermometer, Activity, Gauge, Zap, Droplets, Wind } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { SensorType } from '@/types'
import { formatDistanceToNow } from 'date-fns'

const SENSOR_ICONS: Record<SensorType, React.ElementType> = {
  temperature: Thermometer,
  humidity: Droplets,
  vibration: Activity,
  pressure: Gauge,
  current: Zap,
  voltage: Zap,
  custom: Wind,
}

const SENSOR_LABELS: Record<SensorType, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  vibration: 'Vibration',
  pressure: 'Pressure',
  current: 'Current',
  voltage: 'Voltage',
  custom: 'Custom',
}

interface SensorReadingCardProps {
  sensorType: SensorType
  value: number
  unit: string
  recordedAt: string
  threshold?: number
  className?: string
}

export function SensorReadingCard({
  sensorType,
  value,
  unit,
  recordedAt,
  threshold,
  className,
}: SensorReadingCardProps) {
  const Icon = SENSOR_ICONS[sensorType] ?? Activity
  const label = SENSOR_LABELS[sensorType] ?? sensorType
  const isAlert = threshold != null && value > threshold
  const timeAgo = formatDistanceToNow(new Date(recordedAt), { addSuffix: true })

  return (
    <Card className={cn('transition-shadow', isAlert && 'border-red-300 dark:border-red-700', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'rounded-lg p-2',
              isAlert ? 'bg-red-100 dark:bg-red-900/40' : 'bg-blue-100 dark:bg-blue-900/40',
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5',
                isAlert ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400',
              )}
            />
          </div>
          {isAlert ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              Alert
            </span>
          ) : (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Normal ✓
            </span>
          )}
        </div>

        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className={cn('text-2xl font-bold', isAlert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>
          {value.toFixed(1)}
          <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>
        </p>
        {threshold != null && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Threshold: {threshold} {unit}</p>
        )}
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Updated {timeAgo}</p>
      </CardContent>
    </Card>
  )
}
