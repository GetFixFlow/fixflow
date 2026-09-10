import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LiveReadingBadge } from './LiveReadingBadge'
import type { AssetMetricStatus } from '@/types'

interface AssetSensorTileProps {
  assetId: number
  assetName: string
  assetTag: string
  locationPath?: string
  metrics: AssetMetricStatus[]
  className?: string
}

type TileStatus = 'normal' | 'warning' | 'breached' | 'stale'

function getTileStatus(metrics: AssetMetricStatus[]): TileStatus {
  if (metrics.length === 0) return 'stale'
  if (metrics.some((m) => m.is_breached)) return 'breached'
  if (metrics.some((m) => m.is_stale && !m.is_breached)) return 'stale'
  if (metrics.some((m) => (m.pct_of_threshold ?? 0) >= 80)) return 'warning'
  return 'normal'
}

const STATUS_ICONS: Record<TileStatus, string> = {
  normal: '🟢', warning: '🟡', breached: '🔴', stale: '⚪',
}
const STATUS_BORDERS: Record<TileStatus, string> = {
  normal: 'border-gray-200 dark:border-gray-700',
  warning: 'border-yellow-300 dark:border-yellow-700',
  breached: 'border-red-400 dark:border-red-600',
  stale: 'border-gray-200 dark:border-gray-700 opacity-60',
}

const METRIC_ICONS: Record<string, string> = {
  temperature: '🌡', vibration: '⚡', pressure: '💧', humidity: '💦', current: '⚡', voltage: '🔋',
}

export function AssetSensorTile({ assetId, assetName, assetTag, locationPath, metrics, className }: AssetSensorTileProps) {
  const status = getTileStatus(metrics)
  const latestAt = metrics.reduce<string | undefined>((latest, m) => {
    if (!m.latest_reading_at) return latest
    if (!latest || m.latest_reading_at > latest) return m.latest_reading_at
    return latest
  }, undefined)

  return (
    <div className={cn('rounded-xl border-2 bg-white dark:bg-gray-800 p-4 space-y-3 transition-all hover:shadow-md', STATUS_BORDERS[status], className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span>{STATUS_ICONS[status]}</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{assetName}</span>
            <span className="text-xs text-gray-400 font-mono">{assetTag}</span>
          </div>
          {locationPath && <p className="text-xs text-gray-400 mt-0.5">{locationPath}</p>}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5">
        {metrics.slice(0, 4).map((m) => {
          const metricColor = m.is_breached ? 'text-red-600 dark:text-red-400 font-bold' :
            (m.pct_of_threshold ?? 0) >= 80 ? 'text-yellow-600 dark:text-yellow-400' :
            m.latest_value != null ? 'text-green-600 dark:text-green-400' : 'text-gray-400'

          return (
            <div key={m.metric_name} className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <span>{METRIC_ICONS[m.metric_name.toLowerCase()] ?? '📡'}</span>
                <span className="capitalize">{m.metric_name.replace(/_/g, ' ')}</span>
              </span>
              <div className="flex items-center gap-2">
                {m.latest_value != null ? (
                  <span className={cn('font-mono font-medium', metricColor)}>
                    {m.latest_value} {m.metric_unit}
                    {m.is_breached && ' ⚠️'}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
                <span className={cn('text-xs', m.is_breached ? 'text-red-500' : m.is_stale ? 'text-orange-400' : 'text-green-500')}>
                  {m.is_breached ? '🔴' : m.is_stale ? '⚪' : '✓'}
                </span>
              </div>
            </div>
          )
        })}
        {metrics.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">No readings yet</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
        <LiveReadingBadge lastReadingAt={latestAt} className="text-xs" />
        <Link to={`/iot/assets/${assetId}`} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400">
          View Details <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
