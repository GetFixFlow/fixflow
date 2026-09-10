import { AssetSensorTile } from './AssetSensorTile'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import type { IoTDashboardStats } from '@/types'

interface AssetSensorGridProps {
  assetStatus: IoTDashboardStats['asset_status']
  isLoading?: boolean
}

export function AssetSensorGrid({ assetStatus, isLoading }: AssetSensorGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-full" /><Skeleton className="h-16 w-full" />
          </CardContent></Card>
        ))}
      </div>
    )
  }

  if (assetStatus.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">📡</p>
        <p className="font-medium">No monitored assets yet</p>
        <p className="text-sm mt-1">Add IoT rules to start monitoring assets</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {assetStatus.map((a) => (
        <AssetSensorTile
          key={a.asset_id}
          assetId={a.asset_id}
          assetName={a.asset_name}
          assetTag={a.asset_tag}
          metrics={a.metrics}
        />
      ))}
    </div>
  )
}
