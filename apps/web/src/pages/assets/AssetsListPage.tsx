import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Plus, LayoutGrid, List, MoreVertical, Eye, Pencil, QrCode, Trash2, Upload } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge, statusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AssetCard } from '@/components/assets/AssetCard'
import { AssetFilters, type AssetFilterState } from '@/components/assets/AssetFilters'
import { AssetStatusBadge } from '@/components/assets/AssetStatusBadge'
import { AssetStatusChanger } from '@/components/assets/AssetStatusChanger'
import { LocationBreadcrumb } from '@/components/shared/LocationBreadcrumb'
import { useAssets, useDeleteAsset } from '@/hooks/useAssets'
import { useLocations } from '@/hooks/useLocations'
import { useAuthStore } from '@/stores/authStore'
import type { Asset } from '@/types'

type ViewMode = 'table' | 'grid'

const STORAGE_KEY = 'fixflow-assets-view'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function AssetsListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem(STORAGE_KEY) as ViewMode) ?? 'table',
  )
  const [filters, setFilters] = useState<AssetFilterState>({
    search: '',
    status: '',
    location_id: null,
  })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(filters.search, 300)

  const { data, isLoading } = useAssets({
    page,
    per_page: 25,
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    location_id: filters.location_id ?? undefined,
  })

  const { data: locationsData } = useLocations()
  const locations = locationsData ?? []

  const assets = data?.assets ?? []
  const pagination = (data as { meta?: { pagination?: { count?: number; pages?: number; page?: number } } })?.meta?.pagination

  const deleteMutation = useDeleteAsset()

  const toggleView = (v: ViewMode) => {
    setView(v)
    localStorage.setItem(STORAGE_KEY, v)
  }

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === assets.length) return new Set()
      return new Set(assets.map((a) => a.id))
    })
  }, [assets])

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return
    await deleteMutation.mutateAsync(asset.id)
  }

  const isFiltered = filters.search !== '' || filters.status !== '' || filters.location_id != null

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assets"
        description={pagination?.count != null ? `${pagination.count} total assets` : 'Manage your equipment'}
        actions={
          <div className="flex gap-2">
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/assets/import')}>
                  <Upload className="h-4 w-4" />
                  Import CSV
                </Button>
                <Button size="sm" onClick={() => navigate('/assets/new')}>
                  <Plus className="h-4 w-4" />
                  New Asset
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <AssetFilters
          filters={filters}
          onChange={(f) => { setFilters(f); setPage(1) }}
          locations={locations}
          totalCount={pagination?.count}
        />
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex rounded-md border border-gray-300 dark:border-gray-600">
          <button
            onClick={() => toggleView('table')}
            className={`flex h-8 items-center gap-1.5 rounded-l-md px-3 text-sm transition-colors ${
              view === 'table'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
            Table
          </button>
          <button
            onClick={() => toggleView('grid')}
            className={`flex h-8 items-center gap-1.5 rounded-r-md px-3 text-sm transition-colors ${
              view === 'grid'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
            Grid
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 dark:border-brand-800 dark:bg-brand-900/20">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {selected.size} asset{selected.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Deselect all
            </Button>
            <Button size="sm" variant="destructive">
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        view === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Package}
          title={isFiltered ? 'No assets match your filters' : 'No assets yet'}
          description={isFiltered ? 'Try adjusting or clearing your filters.' : 'Add your first asset to start tracking maintenance.'}
          action={
            isFiltered
              ? { label: 'Clear filters', onClick: () => setFilters({ search: '', status: '', location_id: null }) }
              : canManage
              ? { label: 'Add Asset', onClick: () => navigate('/assets/new') }
              : undefined
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              locations={locations}
              onDelete={canManage ? handleDelete : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm" role="grid">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === assets.length && assets.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                    aria-label="Select all assets"
                  />
                </th>
                {['Asset Tag', 'Name', 'Status', 'Location', 'Open WOs', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={() => navigate(`/assets/${asset.id}`)}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(asset.id) }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(asset.id)}
                      onChange={() => toggleSelect(asset.id)}
                      className="rounded border-gray-300"
                      aria-label={`Select ${asset.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard?.writeText(asset.asset_tag)
                      }}
                      className="hover:text-brand-600"
                      title="Click to copy"
                    >
                      {asset.asset_tag}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{asset.name}</span>
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => { e.stopPropagation() }}
                  >
                    {canManage ? (
                      <AssetStatusChanger asset={asset} />
                    ) : (
                      <AssetStatusBadge status={asset.status} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <LocationBreadcrumb
                      locations={locations}
                      locationId={asset.location_id}
                      compact
                    />
                  </td>
                  <td className="px-4 py-3">
                    {(asset.open_work_orders_count ?? 0) > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        {asset.open_work_orders_count}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                          aria-label="Asset actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="z-50 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-700 dark:bg-gray-800"
                          sideOffset={4}
                          align="end"
                        >
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                            onClick={() => navigate(`/assets/${asset.id}`)}
                          >
                            <Eye className="h-4 w-4" /> View
                          </DropdownMenu.Item>
                          {canManage && (
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                              onClick={() => navigate(`/assets/${asset.id}/edit`)}
                            >
                              <Pencil className="h-4 w-4" /> Edit
                            </DropdownMenu.Item>
                          )}
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                            onClick={() => navigate(`/assets/print-labels?ids=${asset.id}`)}
                          >
                            <QrCode className="h-4 w-4" /> QR Code
                          </DropdownMenu.Item>
                          {canManage && (
                            <>
                              <DropdownMenu.Separator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                onClick={() => handleDelete(asset)}
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenu.Item>
                            </>
                          )}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages != null && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500 dark:text-gray-400">
            Page {pagination.page} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page === pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
