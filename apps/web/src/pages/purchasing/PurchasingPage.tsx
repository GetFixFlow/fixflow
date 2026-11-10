import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { PurchaseStatusBadge } from '@/components/purchasing/PurchaseStatusBadge'
import { PurchaseRequestModal } from '@/components/purchasing/PurchaseRequestModal'
import { PurchaseOrderModal } from '@/components/purchasing/PurchaseOrderModal'
import { usePurchaseOrderList } from '@/hooks/usePurchaseOrders'
import { useDebouncedValue } from '@/hooks/useParts'
import { useAuthStore } from '@/stores/authStore'
import { formatDate, formatMoney } from '@/lib/localeFormat'
import type { PurchaseOrderStatus } from '@/types'

const TABS: { id: string; statuses?: PurchaseOrderStatus[] }[] = [
  { id: 'open', statuses: ['requested', 'approved', 'ordered', 'partially_received'] },
  { id: 'waiting', statuses: ['requested'] },
  { id: 'on_order', statuses: ['ordered', 'partially_received'] },
  { id: 'done', statuses: ['received', 'rejected', 'cancelled'] },
  { id: 'all' },
]

/** Requests for parts and the orders that follow: ask, approve, order, receive. */
export function PurchasingPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [asking, setAsking] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)

  const debounced = useDebouncedValue(search, 300)
  const { data, isLoading, isError, refetch } = usePurchaseOrderList({ status: TABS[tab].statuses, search: debounced || undefined, page })

  const orders = data?.purchase_orders ?? []
  const meta = data?.meta
  const waiting = data?.waiting_for_approval ?? 0
  const filtered = debounced !== '' || tab !== 0

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('purchasing.page.title')}
        description={waiting > 0 ? t('purchasing.page.waiting', { count: waiting }) : t('purchasing.page.subtitle')}
        actions={<Button size="sm" onClick={() => setAsking(true)}><Plus className="h-4 w-4" />{t('purchasing.page.ask')}</Button>}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div role="tablist" aria-label={t('purchasing.page.show')} className="flex flex-wrap gap-1">
          {TABS.map((item, i) => (
            <button
              key={item.id} type="button" role="tab" aria-selected={tab === i}
              onClick={() => { setTab(i); setPage(1) }}
              className={`rounded-md px-3 py-1.5 text-sm ${tab === i ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
            >
              {t(`purchasing.page.tab_${item.id}`)}
              {item.id === 'waiting' && canManage && waiting > 0 ? ` (${waiting})` : ''}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="search" value={search} aria-label={t('purchasing.page.search_aria')} placeholder={t('purchasing.page.search_placeholder')}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : isError ? (
        <EmptyState icon={ShoppingCart} title={t('purchasing.page.load_failed')} action={{ label: t('common.actions.retry'), onClick: () => refetch() }} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={filtered ? t('purchasing.page.nothing') : t('purchasing.page.no_requests')}
          description={filtered ? t('purchasing.page.try_different') : t('purchasing.page.empty')}
          action={!filtered ? { label: t('purchasing.page.ask'), onClick: () => setAsking(true) } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['number', 'asked_by', 'parts', 'vendor', 'total', 'asked_on', 'status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t(`purchasing.page.col_${h}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium">
                    <button type="button" onClick={() => setViewing(order.id)} className="text-brand-600 hover:underline dark:text-brand-400">
                      {order.number}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{order.requested_by?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{order.line_count}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{order.vendor?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatMoney(order.total)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3"><PurchaseStatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{t('purchasing.page.page_of', { page: meta.current_page, pages: meta.total_pages })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('assets.list.previous')}</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>{t('assets.list.next')}</Button>
          </div>
        </div>
      )}

      {asking && <PurchaseRequestModal canPrice={canManage} onClose={() => setAsking(false)} />}
      {viewing && <PurchaseOrderModal id={viewing} canManage={canManage} userId={user?.id} onClose={() => setViewing(null)} />}
    </div>
  )
}
