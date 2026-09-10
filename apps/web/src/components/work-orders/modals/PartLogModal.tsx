import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useLogPart } from '@/hooks/useWorkOrders'

interface PartLogModalProps {
  workOrderId: number
  open: boolean
  onClose: () => void
}

// Placeholder until a parts/inventory API hook is available
const MOCK_PARTS = [
  { id: 1, name: 'Oil Filter', part_number: 'PT-001', unit_cost: 12.5, quantity_on_hand: 15 },
  { id: 2, name: 'V-Belt', part_number: 'PT-002', unit_cost: 28.0, quantity_on_hand: 8 },
  { id: 3, name: 'Bearing Set', part_number: 'PT-003', unit_cost: 45.0, quantity_on_hand: 4 },
  { id: 4, name: 'Seal Kit', part_number: 'PT-004', unit_cost: 18.0, quantity_on_hand: 10 },
]

export function PartLogModal({ workOrderId, open, onClose }: PartLogModalProps) {
  const [partId, setPartId] = useState<number | null>(null)
  const [qty, setQty] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const logPart = useLogPart(workOrderId)

  const selectedPart = MOCK_PARTS.find((p) => p.id === partId)
  const total = Number(qty) * Number(unitCost)
  const overStock = selectedPart && Number(qty) > selectedPart.quantity_on_hand

  const canSubmit = partId && Number(qty) >= 1 && Number(unitCost) > 0 && !overStock

  const handlePartChange = (id: number) => {
    setPartId(id)
    const part = MOCK_PARTS.find((p) => p.id === id)
    if (part) setUnitCost(part.unit_cost.toString())
  }

  const handleLog = async () => {
    if (!partId || !canSubmit) return
    await logPart.mutateAsync({
      part_id: partId,
      quantity_used: Number(qty),
      unit_cost: Number(unitCost),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Parts Used">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Part *
          </label>
          <select
            value={partId ?? ''}
            onChange={(e) => handlePartChange(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">Select part...</option>
            {MOCK_PARTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.part_number}) — {p.quantity_on_hand} in stock
              </option>
            ))}
          </select>
          {selectedPart && (
            <p className="mt-1 text-xs text-gray-500">
              Stock on hand: {selectedPart.quantity_on_hand}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Quantity *
            </label>
            <input
              type="number"
              min="1"
              max={selectedPart?.quantity_on_hand}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Unit Cost ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        {overStock && (
          <p className="text-sm text-red-600 dark:text-red-400">
            ⚠ Quantity exceeds stock on hand ({selectedPart?.quantity_on_hand}).
          </p>
        )}

        {Number(qty) > 0 && Number(unitCost) > 0 && (
          <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              ${total.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleLog}
            disabled={!canSubmit || logPart.isPending}
            loading={logPart.isPending}
          >
            Log Parts
          </Button>
        </div>
      </div>
    </Modal>
  )
}
