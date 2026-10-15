import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useLogPart } from '@/hooks/useWorkOrders'
import { useDebouncedValue, useParts } from '@/hooks/useParts'
import type { Part } from '@/types'
import { formatMoney } from '@/lib/localeFormat'

interface PartLogModalProps {
  workOrderId: number
  open: boolean
  onClose: () => void
}

const FIELD =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

export function PartLogModal({ workOrderId, open, onClose }: PartLogModalProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Part | null>(null)
  const [qty, setQty] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const logPart = useLogPart(workOrderId)
  const { data: parts = [], isLoading } = useParts(useDebouncedValue(search), open && !selected)

  const total = Number(qty) * Number(unitCost)
  const overStock = selected != null && Number(qty) > selected.quantity_on_hand
  const canSubmit = selected != null && Number.isInteger(Number(qty)) && Number(qty) >= 1 && unitCost !== '' && Number(unitCost) >= 0 && !overStock

  const choose = (part: Part) => {
    setSelected(part)
    setUnitCost(part.unit_cost != null ? String(part.unit_cost) : '')
  }

  const close = () => {
    setSearch('')
    setSelected(null)
    setQty('1')
    setUnitCost('')
    onClose()
  }

  // mutate, not mutateAsync: a refusal (say, not enough stock) is reported by the hook and leaves the dialog open.
  const handleLog = () => {
    if (!selected || !canSubmit) return
    logPart.mutate({ part_id: selected.id, quantity_used: Number(qty), unit_cost: Number(unitCost) }, { onSuccess: close })
  }

  return (
    <Modal open={open} onClose={close} title="Log Parts Used">
      <div className="space-y-4">
        {selected ? (
          <div className="flex items-start justify-between rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selected.name}</p>
              <p className="text-xs text-gray-500">
                {selected.sku ? `${selected.sku} · ` : ''}
                {selected.quantity_on_hand} {selected.unit ?? 'each'} in stock
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div>
            <label htmlFor="part-search" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Part *
            </label>
            <input
              id="part-search"
              type="search"
              autoFocus
              placeholder="Search by name or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={FIELD}
            />
            <ul className="mt-2 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {parts.map((part) => (
                <li key={part.id}>
                  <button
                    type="button"
                    onClick={() => choose(part)}
                    disabled={part.quantity_on_hand <= 0}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800"
                  >
                    <span className="text-gray-900 dark:text-gray-100">
                      {part.name}
                      {part.sku && <span className="ml-1 text-xs text-gray-400">{part.sku}</span>}
                    </span>
                    <span className="text-xs text-gray-500">
                      {part.quantity_on_hand <= 0 ? 'Out of stock' : `${part.quantity_on_hand} in stock`}
                    </span>
                  </button>
                </li>
              ))}
              {!isLoading && parts.length === 0 && (
                <li className="px-3 py-2 text-xs text-gray-400">
                  {search ? 'No parts match that search.' : 'No parts have been added yet.'}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="part-qty" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Quantity *
            </label>
            <input
              id="part-qty"
              type="number"
              min="1"
              step="1"
              max={selected?.quantity_on_hand}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="part-cost" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Unit Cost ($) *
            </label>
            <input
              id="part-cost"
              type="number"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>

        {overStock && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Quantity exceeds the stock on hand ({selected?.quantity_on_hand}).
          </p>
        )}

        {canSubmit && (
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatMoney(total)}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleLog} disabled={!canSubmit || logPart.isPending} loading={logPart.isPending}>
            Log Parts
          </Button>
        </div>
      </div>
    </Modal>
  )
}
