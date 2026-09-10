import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { IoTDashboardStats } from '@/types'

interface AssetHealthHeatmapProps {
  assetStatus: IoTDashboardStats['asset_status']
}

function getDotColor(metrics: { is_breached: boolean; is_stale: boolean; pct_of_threshold?: number }[]) {
  if (metrics.some((m) => m.is_breached)) return 'bg-red-500 text-red-500'
  if (metrics.some((m) => m.is_stale)) return 'bg-gray-300 text-gray-400'
  if (metrics.some((m) => (m.pct_of_threshold ?? 0) >= 80)) return 'bg-yellow-400 text-yellow-500'
  return 'bg-green-500 text-green-500'
}

export function AssetHealthHeatmap({ assetStatus }: AssetHealthHeatmapProps) {
  if (assetStatus.length === 0) return null

  return (
    <div className="space-y-3">
      {assetStatus.map((asset) => (
        <div key={asset.asset_id} className="flex items-center gap-3 text-sm">
          <Link to={`/assets/${asset.asset_id}`} className="w-40 truncate text-gray-700 dark:text-gray-300 hover:text-brand-600 font-medium">
            {asset.asset_name}
          </Link>
          <div className="flex gap-1.5">
            {asset.metrics.map((m) => {
              const colorClass = getDotColor([m])
              return (
                <Link key={m.metric_name} to={`/iot/assets/${asset.asset_id}`}
                  title={`${m.metric_name}: ${m.latest_value ?? '—'} ${m.metric_unit ?? ''}`}
                  className={cn('h-4 w-4 rounded-full transition-transform hover:scale-125', colorClass.split(' ')[0])} />
              )
            })}
            {asset.metrics.length === 0 && (
              <span className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-600" title="No readings" />
            )}
          </div>
          <span className="text-xs text-gray-400">
            {asset.metrics.filter((m) => m.is_breached).length > 0 &&
              `${asset.metrics.filter((m) => m.is_breached).length} alert${asset.metrics.filter((m) => m.is_breached).length > 1 ? 's' : ''}`}
          </span>
        </div>
      ))}
      <div className="flex gap-3 text-xs text-gray-400 pt-1">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Normal</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />Warning</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Alert</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gray-300" />No data</span>
      </div>
    </div>
  )
}
