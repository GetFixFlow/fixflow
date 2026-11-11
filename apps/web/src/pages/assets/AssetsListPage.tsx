import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, Plus, LayoutGrid, List, MoreVertical, Eye, Pencil, Printer, QrCode, Trash2, Upload } from 'lucide-react'
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
import { labelQuery } from '@/lib/labelSheet'
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  // The QR scanner sends a label's code here as ?search=, so the list shows that asset.
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem(STORAGE_KEY) as ViewMode) ?? 'table',
  )
  const [filters, setFilters] = useState<AssetFilterState>({
    search: searchParams.get('search') ?? '',
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
    if (!confirm(t('assets.list.confirm_delete', { name: asset.name }))) return
    await deleteMutation.mutateAsync(asset.id)
  }

  const isFiltered = filters.search !== '' || filters.status !== '' || filters.location_id != null

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('assets.list.title')}
        description={pagination?.count != null ? t('assets.list.total', { count: pagination.count }) : t('assets.list.manage')}
        actions={
          <div className="flex gap-2">
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate(`/assets/print-labels${labelQuery(filters)}`)}>
                  <Printer className="h-4 w-4" />
                  {t('assets.list.print_labels')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/import?kind=assets')}>
                  <Upload className="h-4 w-4" />
                  {t('assets.list.import_csv')}
                </Button>
                <Button size="sm" onClick={() => navigate('/assets/new')}>
                  <Plus className="h-4 w-4" />
                  {t('assets.list.new')}
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
            aria-label={t('assets.list.table_view')}
          >
            <List className="h-4 w-4" />
            {t('assets.list.table')}
          </button>
          <button
            onClick={() => toggleView('grid')}
            className={`flex h-8 items-center gap-1.5 rounded-r-md px-3 text-sm transition-colors ${
              view === 'grid'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
            aria-label={t('assets.list.grid_view')}
          >
            <LayoutGrid className="h-4 w-4" />
            {t('assets.list.grid')}
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 dark:border-brand-800 dark:bg-brand-900/20">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {t('assets.list.selected', { count: selected.size })}
          </span>
          <div className="flex gap-2 ml-auto">
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/assets/print-labels?ids=${[...selected].join(',')}`)}>
                <Printer className="h-4 w-4" />
                {t('assets.list.print_labels')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              {t('assets.list.deselect_all')}
            </Button>
            <Button size="sm" variant="destructive">
              {t('assets.list.delete_selected')}
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
          title={isFiltered ? t('assets.list.no_match') : t('assets.list.no_assets')}
          description={isFiltered ? t('assets.list.try_adjusting') : t('assets.list.add_first')}
          action={
            isFiltered
              ? { label: t('assets.list.clear_filters'), onClick: () => setFilters({ search: '', status: '', location_id: null }) }
              : canManage
              ? { label: t('assets.list.add_asset'), onClick: () => navigate('/assets/new') }
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
                    aria-label={t('assets.list.select_all')}
                  />
                </th>
                {['tag', 'name', 'status', 'location', 'open_wos', 'actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {t(`assets.list.col_${h}`)}
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
                      // The cell toggles it (a click on the box reaches the cell too, so toggling here as well would undo it).
                      onChange={() => undefined}
                      className="rounded border-gray-300"
                      aria-label={t('assets.list.select_one', { name: asset.name })}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard?.writeText(asset.asset_tag)
                      }}
                      className="hover:text-brand-600"
                      title={t('assets.list.click_to_copy')}
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
                      <span className="text-gray-500 dark:text-gray-400">—</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                          aria-label={t('assets.list.actions_aria')}
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
                            <Eye className="h-4 w-4" /> {t('assets.list.menu_view')}
                          </DropdownMenu.Item>
                          {canManage && (
                            <DropdownMenu.Item
                              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                              onClick={() => navigate(`/assets/${asset.id}/edit`)}
                            >
                              <Pencil className="h-4 w-4" /> {t('assets.list.menu_edit')}
                            </DropdownMenu.Item>
                          )}
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                            onClick={() => navigate(`/assets/print-labels?ids=${asset.id}`)}
                          >
                            <QrCode className="h-4 w-4" /> {t('assets.list.menu_qr')}
                          </DropdownMenu.Item>
                          {canManage && (
                            <>
                              <DropdownMenu.Separator className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                onClick={() => handleDelete(asset)}
                              >
                                <Trash2 className="h-4 w-4" /> {t('assets.list.menu_delete')}
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
            {t('assets.list.page_of', { page: pagination.page, pages: pagination.pages })}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('assets.list.previous')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page === pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('assets.list.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
