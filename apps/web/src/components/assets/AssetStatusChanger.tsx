import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { ChevronDown } from 'lucide-react'
import { AssetStatusBadge } from './AssetStatusBadge'
import { AssetHealthIndicator } from './AssetHealthIndicator'
import { useUpdateAsset } from '@/hooks/useAssets'
import type { Asset, AssetStatus } from '@/types'

const STATUSES: AssetStatus[] = ['operational', 'degraded', 'down', 'maintenance', 'offline', 'decommissioned']
const DESTRUCTIVE: AssetStatus[] = ['down', 'decommissioned']

interface AssetStatusChangerProps {
  asset: Asset
}

export function AssetStatusChanger({ asset }: AssetStatusChangerProps) {
  const [open, setOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<AssetStatus | null>(null)
  const updateMutation = useUpdateAsset(asset.id)

  const handleSelect = async (status: AssetStatus) => {
    if (DESTRUCTIVE.includes(status)) {
      setPendingStatus(status)
      return
    }
    setOpen(false)
    await updateMutation.mutateAsync({ status })
  }

  const confirmDestructive = async () => {
    if (!pendingStatus) return
    setOpen(false)
    setPendingStatus(null)
    await updateMutation.mutateAsync({ status: pendingStatus })
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Change asset status"
        >
          <AssetStatusBadge status={asset.status} />
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 min-w-[180px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          sideOffset={4}
        >
          {pendingStatus ? (
            <div className="p-3 space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Change status to{' '}
                <span className="font-semibold capitalize">{pendingStatus}</span>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPendingStatus(null)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDestructive}
                  className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <div>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  disabled={s === asset.status}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
                >
                  <AssetHealthIndicator status={s} variant="dot" />
                  <span className="capitalize">{s}</span>
                  {s === asset.status && (
                    <span className="ml-auto text-xs text-gray-400">current</span>
                  )}
                </button>
              ))}
            </div>
          )}
          <Popover.Arrow className="fill-white dark:fill-gray-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
