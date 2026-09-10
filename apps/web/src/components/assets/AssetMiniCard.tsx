import { cn } from '@/lib/utils'
import { AssetHealthIndicator } from './AssetHealthIndicator'
import type { Asset, Location } from '@/types'
import { getLocationDisplayPath } from '@/utils/locationUtils'

interface AssetMiniCardProps {
  asset: Asset
  locations?: Location[]
  className?: string
}

export function AssetMiniCard({ asset, locations = [], className }: AssetMiniCardProps) {
  const locationPath = getLocationDisplayPath(locations, asset.location_id)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800',
        className,
      )}
    >
      <AssetHealthIndicator status={asset.status} variant="dot" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{asset.name}</p>
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{asset.asset_tag}</p>
        {locationPath && (
          <p className="truncate text-xs text-gray-400 dark:text-gray-500">{locationPath}</p>
        )}
      </div>
    </div>
  )
}
