import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { AssetStatusBadge } from './AssetStatusBadge'
import { AssetHealthIndicator } from './AssetHealthIndicator'
import { useAssets } from '@/hooks/useAssets'
import type { Asset } from '@/types'
import { cn } from '@/lib/utils'

interface AssetSelectProps {
  value?: number | null
  onChange: (id: number | null) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  id?: string
  label?: string
}

export function AssetSelect({
  value,
  onChange,
  placeholder = 'Select an asset...',
  disabled = false,
  error,
  id,
  label,
}: AssetSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useAssets(
    search ? { search, per_page: 20 } : { per_page: 20 },
  )
  const assets = data?.assets ?? []

  const selectedAsset = value != null ? assets.find((a) => a.id === value) : null

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (asset: Asset) => {
      onChange(asset.id)
      setOpen(false)
      setSearch('')
    },
    [onChange],
  )

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800',
            error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600',
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {selectedAsset ? (
            <span className="flex flex-1 items-center gap-2 truncate">
              <AssetHealthIndicator status={selectedAsset.status} variant="dot" />
              <span className="truncate text-gray-900 dark:text-gray-100">{selectedAsset.name}</span>
              <span className="font-mono text-xs text-gray-400">{selectedAsset.asset_tag}</span>
            </span>
          ) : (
            <span className="flex-1 text-left text-gray-400">{placeholder}</span>
          )}
          <span className="flex items-center gap-1">
            {value != null && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onChange(null) }}
                onKeyDown={(e) => e.key === 'Enter' && onChange(null)}
                className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </span>
            )}
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 p-2 dark:border-gray-700">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search assets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-52 overflow-auto py-1" role="listbox">
              {isLoading ? (
                <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
              ) : assets.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No assets found</div>
              ) : (
                assets.map((asset) => (
                  <button
                    key={asset.id}
                    role="option"
                    aria-selected={asset.id === value}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSelect(asset)}
                  >
                    <AssetHealthIndicator status={asset.status} variant="dot" />
                    <span className="flex-1 truncate text-left text-gray-900 dark:text-gray-100">
                      {asset.name}
                    </span>
                    <span className="font-mono text-xs text-gray-400">{asset.asset_tag}</span>
                    <AssetStatusBadge status={asset.status} />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
