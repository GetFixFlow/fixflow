import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useDebouncedValue, useParts } from '@/hooks/useParts'
import { useCreatePurchaseOrder, useUpdatePurchaseOrder } from '@/hooks/usePurchaseOrders'
import { suggestedQuantity } from '@/lib/purchasing'
import type { Part, PurchaseOrder } from '@/types'

interface Row {
  /** The line's id when editing a request already sent. */
  id?: number
  part_id: number
  name: string
  sku?: string | null
  unit: string
  quantity: string
  unit_cost: string
}

const fieldClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

const rowFor = (part: Part, quantity = ''): Row => ({
  part_id: part.id,
  name: part.name,
  sku: part.sku,
  unit: part.unit ?? 'each',
  quantity,
  unit_cost: part.unit_cost != null ? String(part.unit_cost) : '',
})

interface PurchaseRequestModalProps {
  onClose: () => void
  /** Changing this request; omit to ask for something new. */
  order?: PurchaseOrder
  /** Start the request with this part on it (from the parts screen). */
  part?: Part
  /** Managers can set what each costs; anyone else gets the part's own cost. */
  canPrice?: boolean
}

/** Asking for parts: what is needed, how many, and why. Also used to change a request that has not been ordered. */
export function PurchaseRequestModal({ onClose, order, part, canPrice = false }: PurchaseRequestModalProps) {
  const create = useCreatePurchaseOrder()
  const update = useUpdatePurchaseOrder(order?.id ?? 0)
  const pending = create.isPending || update.isPending

  const [rows, setRows] = useState<Row[]>(() =>
    order?.lines
      ? order.lines.map((line) => ({
          id: line.id,
          part_id: line.part_id,
          name: line.part_name,
          sku: line.part_sku,
          unit: line.unit ?? 'each',
          quantity: String(line.quantity),
          unit_cost: line.unit_cost != null ? String(line.unit_cost) : '',
        }))
      : part ? [rowFor(part, String(suggestedQuantity(part)))] : [],
  )
  const [reason, setReason] = useState(order?.reason ?? (part?.low_stock ? `${part.name} is running low` : ''))
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string>()

  const { data: found = [], isLoading } = useParts(useDebouncedValue(search), adding)
  const choices = found.filter((p) => !rows.some((row) => row.part_id === p.id))

  const change = (index: number, patch: Partial<Row>) => setRows((all) => all.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rows.length === 0) return setError('Add at least one part.')
    if (rows.some((row) => !(Number(row.quantity) > 0))) return setError('Enter how many of each part, above zero.')
    setError(undefined)
    const lines = rows.map((row) => ({
      id: row.id,
      part_id: row.part_id,
      quantity: Number(row.quantity),
      // Left out for anyone but a manager, so the part's own cost is used.
      unit_cost: canPrice && row.unit_cost !== '' ? Number(row.unit_cost) : undefined,
    }))
    const body = { reason: reason.trim() || null, notes: notes.trim() || null }
    if (order) update.mutate({ order: body, lines }, { onSuccess: onClose })
    else create.mutate({ order: body, lines }, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={order ? `Change ${order.number}` : 'Ask for parts'}
      description={order ? undefined : 'A manager approves it, then it is ordered. The stock goes up when the parts arrive.'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Parts</p>
          {rows.length === 0 && !adding && (
            <p className="rounded-lg border-2 border-dashed border-gray-200 py-4 text-center text-sm text-gray-400 dark:border-gray-700">
              No parts added yet
            </p>
          )}
          {rows.map((row, index) => (
            <div key={row.part_id} className="flex items-end gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{row.name}</p>
                {row.sku && <p className="text-xs text-gray-400">{row.sku}</p>}
              </div>
              <label className="text-xs text-gray-500">
                How many ({row.unit})
                <input
                  type="number" min="0" step="any" value={row.quantity} aria-label={`How many ${row.name}`}
                  onChange={(e) => change(index, { quantity: e.target.value })}
                  className={`${fieldClass} mt-0.5 w-24`}
                />
              </label>
              {canPrice && (
                <label className="text-xs text-gray-500">
                  Each
                  <input
                    type="number" min="0" step="any" value={row.unit_cost} aria-label={`Cost of ${row.name}`}
                    onChange={(e) => change(index, { unit_cost: e.target.value })}
                    className={`${fieldClass} mt-0.5 w-24`}
                  />
                </label>
              )}
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${row.name}`} onClick={() => setRows((all) => all.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}

          {adding ? (
            <div className="space-y-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              <input
                autoFocus type="text" placeholder="Search parts…" aria-label="Search parts" value={search}
                onChange={(e) => setSearch(e.target.value)} className={fieldClass}
              />
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {choices.map((p) => (
                  <button
                    key={p.id} type="button"
                    onClick={() => { setRows((all) => [...all, rowFor(p, String(suggestedQuantity(p)))]); setAdding(false); setSearch('') }}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="text-gray-900 dark:text-gray-100">{p.name} <span className="ml-1 text-xs text-gray-400">{p.sku}</span></span>
                    <span className="text-xs text-gray-400">{p.quantity_on_hand} in stock</span>
                  </button>
                ))}
                {!isLoading && choices.length === 0 && (
                  <p className="px-2 py-1 text-xs text-gray-400">{search ? 'No matching parts' : 'No other parts to add'}</p>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { setAdding(false); setSearch('') }}>Cancel</Button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" />Add part
            </Button>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>

        <div>
          <label htmlFor="po-reason" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Why is it needed?</label>
          <textarea id="po-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="po-notes" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={pending} className="flex-1">{pending ? 'Sending…' : order ? 'Save changes' : 'Send request'}</Button>
        </div>
      </form>
    </Modal>
  )
}
