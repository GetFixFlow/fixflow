import { useNavigate } from 'react-router-dom'
import { MoreVertical, Eye, Pencil, QrCode, Trash2 } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Card, CardContent } from '@/components/ui/Card'
import { AssetStatusBadge } from './AssetStatusBadge'
import { AssetHealthIndicator } from './AssetHealthIndicator'
import { cn } from '@/lib/utils'
import type { Asset, Location } from '@/types'
import { getLocationDisplayPath } from '@/utils/locationUtils'

interface AssetCardProps {
  asset: Asset
  locations?: Location[]
  onDelete?: (asset: Asset) => void
  className?: string
}

export function AssetCard({ asset, locations = [], onDelete, className }: AssetCardProps) {
  const navigate = useNavigate()
  const locationPath = getLocationDisplayPath(locations, asset.location_id)

  return (
    <Card
      className={cn('group relative transition-shadow hover:shadow-md', className)}
      onClick={() => navigate(`/assets/${asset.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/assets/${asset.id}`)}
      aria-label={`View asset ${asset.name}`}
    >
      <CardContent className="p-4">
        {/* Three-dot menu */}
        <div
          className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Asset options"
              >
                <MoreVertical className="h-4 w-4 text-gray-500" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-700 dark:bg-gray-800"
                sideOffset={4}
              >
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  onClick={() => navigate(`/assets/${asset.id}`)}
                >
                  <Eye className="h-4 w-4" /> View
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  onClick={() => navigate(`/assets/${asset.id}/edit`)}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  onClick={() => navigate(`/assets/print-labels?ids=${asset.id}`)}
                >
                  <QrCode className="h-4 w-4" /> QR Code
                </DropdownMenu.Item>
                {onDelete && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      onClick={() => onDelete(asset)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Status dot + label */}
        <div className="mb-3 flex items-center gap-1.5">
          <AssetHealthIndicator status={asset.status} variant="dot" />
          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{asset.status}</span>
        </div>

        {/* Name + tag */}
        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-8">{asset.name}</p>
        <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{asset.asset_tag}</p>

        {/* Location */}
        {locationPath && (
          <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">{locationPath}</p>
        )}

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {(asset.open_work_orders_count ?? 0) > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              {asset.open_work_orders_count} open WO{(asset.open_work_orders_count ?? 0) > 1 ? 's' : ''}
            </span>
          )}
          {asset.last_work_order_date && (
            <span>
              Last:{' '}
              {Math.floor(
                (Date.now() - new Date(asset.last_work_order_date).getTime()) / 86400000,
              )}d ago
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
