import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, Pencil, Plus, Search, ShoppingCart, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { PartFormModal } from '@/components/parts/PartFormModal'
import { StockAdjustModal } from '@/components/parts/StockAdjustModal'
import { PurchaseRequestModal } from '@/components/purchasing/PurchaseRequestModal'
import { useCatalog, useDebouncedValue, useDeletePart } from '@/hooks/useParts'
import { useAuthStore } from '@/stores/authStore'
import type { Part } from '@/types'
import { formatMoney } from '@/lib/localeFormat'


function StockBadge({ part }: { part: Part }) {
  if (Number(part.quantity_on_hand) <= 0) return <Badge variant="destructive">Out of stock</Badge>
  if (part.low_stock) return <Badge variant="warning">Low</Badge>
  return <Badge variant="success">In stock</Badge>
}

export function PartsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const canManage = role === 'admin' || role === 'manager'
  const canDelete = role === 'admin'

  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Part | 'new' | null>(null)
  const [adjusting, setAdjusting] = useState<Part | null>(null)
  const [requesting, setRequesting] = useState<Part | null>(null)

  const debounced = useDebouncedValue(search, 300)
  const { data, isLoading, isError, refetch } = useCatalog({ search: debounced, lowStock: lowOnly, page })
  const deletePart = useDeletePart()

  const parts = data?.parts ?? []
  const meta = data?.meta
  const filtered = debounced !== '' || lowOnly

  const remove = (part: Part) => {
    if (!confirm(`Delete "${part.name}"? This cannot be undone.`)) return
    deletePart.mutate(part.id)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parts & Inventory"
        description={meta ? `${meta.total_count} ${filtered ? 'matching' : 'in the catalog'}` : 'Spare parts and stock levels'}
        actions={
          canManage && (
            <>
              <Link to="/import?kind=parts"><Button size="sm" variant="outline"><Upload className="h-4 w-4" />Import CSV</Button></Link>
              <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Add part</Button>
            </>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or SKU"
            aria-label="Search parts"
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => { setLowOnly(e.target.checked); setPage(1) }}
            className="rounded border-gray-300"
          />
          Low stock only
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : isError ? (
        <EmptyState icon={Boxes} title="The parts could not be loaded" action={{ label: 'Try again', onClick: () => refetch() }} />
      ) : parts.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={filtered ? 'No parts match' : 'No parts yet'}
          description={
            filtered
              ? lowOnly && debounced === '' ? 'Nothing is at or below its reorder point.' : 'Try a different search.'
              : canManage ? 'Add the spare parts you keep so technicians can log them on work orders.' : 'A manager can add the spare parts you keep.'
          }
          action={!filtered && canManage ? { label: 'Add part', onClick: () => setEditing('new') } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {['Part', 'SKU', 'On hand', 'Reorder at', 'Unit cost', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                ))}
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {parts.map((part) => (
                <tr key={part.id}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{part.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{part.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{part.quantity_on_hand} {part.unit}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{part.reorder_point}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatMoney(part.unit_cost)}</td>
                  <td className="px-4 py-3"><StockBadge part={part} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setAdjusting(part)} aria-label={`Adjust stock of ${part.name}`}>
                        <SlidersHorizontal className="h-4 w-4" />Adjust
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRequesting(part)} aria-label={`Ask for more ${part.name}`}>
                        <ShoppingCart className="h-4 w-4" />Order
                      </Button>
                      {canManage && (
                        <Button variant="ghost" size="icon" onClick={() => setEditing(part)} aria-label={`Edit ${part.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => remove(part)} aria-label={`Delete ${part.name}`}>
                          <Trash2 className="h-4 w-4 text-red-500" />
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
          <p className="text-sm text-gray-500">Page {meta.current_page} of {meta.total_pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {editing && (
        <PartFormModal open part={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      {adjusting && <StockAdjustModal part={adjusting} onClose={() => setAdjusting(null)} />}
      {requesting && <PurchaseRequestModal part={requesting} canPrice={canManage} onClose={() => setRequesting(null)} />}
    </div>
  )
}
