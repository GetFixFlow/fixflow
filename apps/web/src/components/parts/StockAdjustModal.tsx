import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAdjustStock } from '@/hooks/useParts'
import type { Part } from '@/types'

interface StockAdjustModalProps {
  part: Part
  onClose: () => void
}

export function StockAdjustModal({ part, onClose }: StockAdjustModalProps) {
  const adjust = useAdjustStock(part.id)
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()

  const amount = Number(quantity)
  const unit = part.unit ?? 'each'
  const after = Number.isFinite(amount) && amount > 0 ? Number(part.quantity_on_hand) + (direction === 'add' ? amount : -amount) : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!(amount > 0)) return setError('Enter a quantity greater than zero.')
    if (after != null && after < 0) return setError(`Only ${part.quantity_on_hand} ${unit} in stock.`)
    setError(undefined)
    adjust.mutate({ quantity: amount, direction, reason: reason.trim() || undefined }, { onSuccess: onClose })
  }

  return (
    <Modal open onClose={onClose} title={`Adjust stock: ${part.name}`} description={`${part.quantity_on_hand} ${unit} in stock now.`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex rounded-md border border-gray-300 dark:border-gray-600" role="radiogroup" aria-label="Direction">
          {(['add', 'remove'] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => setDirection(d)}
              className={`flex-1 px-3 py-1.5 text-sm first:rounded-l-md last:rounded-r-md ${
                direction === d ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {d === 'add' ? 'Add stock' : 'Remove stock'}
            </button>
          ))}
        </div>
        <Input
          id="adjust-quantity"
          label={`Quantity (${unit})`}
          type="number"
          step="any"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          error={error}
          autoFocus
        />
        <Input
          id="adjust-reason"
          label="Reason"
          placeholder="Optional: delivery, stock count, damaged…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {after != null && after >= 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {part.quantity_on_hand} → <span className="font-semibold">{after}</span> {unit}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={adjust.isPending} className="flex-1">
            {adjust.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
