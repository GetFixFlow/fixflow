import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { AssetQRCode } from '@/components/assets/AssetQRCode'
import { useAssets } from '@/hooks/useAssets'
import { useLocations } from '@/hooks/useLocations'
import { getLocationDisplayPath } from '@/utils/locationUtils'
import type { Asset } from '@/types'
import { cn } from '@/lib/utils'

type LabelSize = 'small' | 'medium' | 'large'

const SIZE_CONFIG: Record<LabelSize, { qrSize: 'sm' | 'md' | 'lg'; cols: number; label: string }> = {
  small: { qrSize: 'sm', cols: 2, label: 'Small (2×1")' },
  medium: { qrSize: 'md', cols: 2, label: 'Medium (3×2")' },
  large: { qrSize: 'lg', cols: 1, label: 'Large (4×3")' },
}

interface LabelProps {
  asset: Asset
  locationPath: string
  qrSize: 'sm' | 'md' | 'lg'
}

function AssetLabel({ asset, locationPath, qrSize }: LabelProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded border border-gray-300 p-2 print:border-gray-400">
      <AssetQRCode
        assetId={asset.id}
        assetTag={asset.asset_tag}
        size={qrSize}
        showActions={false}
      />
      <p className="text-center text-sm font-bold text-gray-900">{asset.name}</p>
      <p className="font-mono text-xs text-gray-600">{asset.asset_tag}</p>
      {locationPath && (
        <p className="text-center text-xs text-gray-500">{locationPath.split(' > ').slice(-1)[0]}</p>
      )}
      <p className="text-xs text-gray-400">fixflow.dev</p>
    </div>
  )
}

export function QRLabelPrintPage() {
  const [searchParams] = useSearchParams()
  const [labelSize, setLabelSize] = useState<LabelSize>('medium')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const { data: assetsData } = useAssets({ per_page: 100 })
  const assets = assetsData?.assets ?? []
  const { data: locationsData } = useLocations()
  const locations = locationsData ?? []

  // Pre-select from query param
  useEffect(() => {
    const idsParam = searchParams.get('ids')
    if (idsParam) {
      const ids = idsParam.split(',').map(Number).filter(Boolean)
      setSelectedIds(new Set(ids))
    }
  }, [searchParams])

  const toggleAsset = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedAssets = assets.filter((a) => selectedIds.has(a.id))
  const config = SIZE_CONFIG[labelSize]

  return (
    <div className="space-y-4 print:hidden">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/assets">
          <ArrowLeft className="h-4 w-4" />
          Assets
        </Link>
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Print QR Labels</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedIds.size} asset{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
        </div>
        <Button onClick={() => window.print()} disabled={selectedIds.size === 0}>
          <Printer className="h-4 w-4" />
          Print Labels
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: settings */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="font-medium text-gray-900 dark:text-gray-100">Label Size</h2>
              {(['small', 'medium', 'large'] as LabelSize[]).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="label-size"
                    value={s}
                    checked={labelSize === s}
                    onChange={() => setLabelSize(s)}
                    className="text-brand-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {SIZE_CONFIG[s].label}
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900 dark:text-gray-100">Select Assets</h2>
                <button
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.size === assets.length
                        ? new Set()
                        : new Set(assets.map((a) => a.id)),
                    )
                  }
                  className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  {selectedIds.size === assets.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="max-h-64 overflow-auto space-y-1">
                {assets.map((asset) => (
                  <label
                    key={asset.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(asset.id)}
                      onChange={() => toggleAsset(asset.id)}
                      className="rounded border-gray-300 text-brand-600"
                    />
                    <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                      {asset.name}
                    </span>
                    <span className="font-mono text-xs text-gray-400">{asset.asset_tag}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 font-medium text-gray-900 dark:text-gray-100">Preview</h2>
              {selectedAssets.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Select assets to preview labels</p>
              ) : (
                <div
                  className={cn(
                    'grid gap-2',
                    config.cols === 2 ? 'grid-cols-2' : 'grid-cols-1',
                  )}
                >
                  {selectedAssets.map((asset) => (
                    <AssetLabel
                      key={asset.id}
                      asset={asset}
                      locationPath={getLocationDisplayPath(locations, asset.location_id)}
                      qrSize={config.qrSize}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print-only section */}
      <div className="hidden print:block">
        <div
          className={cn(
            'grid gap-4',
            config.cols === 2 ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {selectedAssets.map((asset) => (
            <AssetLabel
              key={asset.id}
              asset={asset}
              locationPath={getLocationDisplayPath(locations, asset.location_id)}
              qrSize={config.qrSize}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
