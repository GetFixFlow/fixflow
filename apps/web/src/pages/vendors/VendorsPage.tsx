import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { VendorFormModal } from '@/components/vendors/VendorFormModal'
import { VendorDetailModal } from '@/components/vendors/VendorDetailModal'
import { useDeleteVendor, useVendorList } from '@/hooks/useVendors'
import { useDebouncedValue } from '@/hooks/useParts'
import { useAuthStore } from '@/stores/authStore'
import type { Vendor } from '@/types'

const selectClass =
  'h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

/** The outside companies that do maintenance work, with the people to call at each. */
export function VendorsPage() {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.user?.role)
  const canManage = role === 'admin' || role === 'manager'
  const canDelete = role === 'admin'

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<Vendor | null>(null)
  const [editing, setEditing] = useState<Vendor | 'new' | null>(null)

  const debounced = useDebouncedValue(search, 300)
  const { data, isLoading, isError, refetch } = useVendorList({
    search: debounced || undefined,
    category: category || undefined,
    active: status === '' ? undefined : status === 'active',
    page,
  })
  const deleteVendor = useDeleteVendor()

  const vendors = data?.vendors ?? []
  const meta = data?.meta
  const filtered = debounced !== '' || category !== '' || status !== ''

  const remove = (vendor: Vendor) => {
    if (!confirm(t('vendors.page.confirm_delete', { name: vendor.name }))) return
    deleteVendor.mutate(vendor.id)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('vendors.page.title')}
        description={meta ? t(filtered ? 'vendors.page.count_matching' : 'vendors.page.count_list', { count: meta.total_count }) : t('vendors.page.subtitle')}
        actions={canManage && <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />{t('vendors.page.add')}</Button>}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('vendors.page.search_placeholder')}
            aria-label={t('vendors.page.search_aria')}
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select aria-label={t('vendors.page.category_aria')} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className={selectClass}>
          <option value="">{t('vendors.page.all_categories')}</option>
          {(data?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          aria-label={t('vendors.page.status_aria')} value={status} className={selectClass}
          onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }}
        >
          <option value="">{t('vendors.page.active_and_not')}</option>
          <option value="active">{t('vendors.page.active')}</option>
          <option value="inactive">{t('vendors.page.not_in_use')}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : isError ? (
        <EmptyState icon={Building2} title={t('vendors.page.load_failed')} action={{ label: t('common.actions.retry'), onClick: () => refetch() }} />
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filtered ? t('vendors.page.no_match') : t('vendors.page.no_vendors')}
          description={
            filtered
              ? t('vendors.page.try_different')
              : canManage ? t('vendors.page.empty_manager') : t('vendors.page.empty_other')
          }
          action={!filtered && canManage ? { label: t('vendors.page.add'), onClick: () => setEditing('new') } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['vendor', 'what', 'phone', 'email', 'work_orders', 'status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t(`vendors.page.col_${h}`)}</th>
                ))}
                <th className="px-4 py-3"><span className="sr-only">{t('vendors.page.col_actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="px-4 py-3 font-medium">
                    <button type="button" onClick={() => setViewing(vendor)} className="text-left text-brand-600 hover:underline dark:text-brand-400">
                      {vendor.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{vendor.category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{vendor.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{vendor.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{vendor.work_orders_count}</td>
                  <td className="px-4 py-3">
                    <Badge variant={vendor.active ? 'success' : 'secondary'}>{vendor.active ? t('vendors.page.active') : t('vendors.page.not_in_use')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canManage && (
                        <Button variant="ghost" size="icon" onClick={() => setEditing(vendor)} aria-label={t('vendors.page.edit_aria', { name: vendor.name })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => remove(vendor)} aria-label={t('vendors.page.delete_aria', { name: vendor.name })}>
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('vendors.page.page_of', { page: meta.current_page, pages: meta.total_pages })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('assets.list.previous')}</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>{t('assets.list.next')}</Button>
          </div>
        </div>
      )}

      {viewing && (
        <VendorDetailModal
          vendor={viewing}
          canManage={canManage}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
        />
      )}
      {editing && <VendorFormModal open vendor={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
