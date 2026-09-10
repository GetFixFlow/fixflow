import { useState } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { PMRequiredPart, Part } from '@/types'

// Mock parts for now (pending real parts API hook)
const MOCK_PARTS: Part[] = [
  { id: 1, name: 'Oil Filter', part_number: 'PT-001', quantity_on_hand: 5, unit_cost: 12.50, organization_id: 1, created_at: '', updated_at: '' },
  { id: 2, name: 'V-Belt Drive', part_number: 'PT-002', quantity_on_hand: 2, unit_cost: 28.00, organization_id: 1, created_at: '', updated_at: '' },
  { id: 3, name: 'Air Filter', part_number: 'PT-003', quantity_on_hand: 10, unit_cost: 8.00, organization_id: 1, created_at: '', updated_at: '' },
  { id: 4, name: 'Bearing Kit', part_number: 'PT-004', quantity_on_hand: 1, unit_cost: 45.00, organization_id: 1, created_at: '', updated_at: '' },
]

interface RequiredPartsEditorProps {
  value: PMRequiredPart[]
  onChange: (parts: PMRequiredPart[]) => void
}

export function RequiredPartsEditor({ value, onChange }: RequiredPartsEditorProps) {
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const filtered = MOCK_PARTS.filter(
    (p) =>
      !value.some((v) => v.part_id === p.id) &&
      (p.name.toLowerCase().includes(search.toLowerCase()) || (p.part_number ?? '').toLowerCase().includes(search.toLowerCase())),
  )

  const addPart = (part: Part) => {
    onChange([...value, { part_id: part.id, part, quantity: 1 }])
    setShowSearch(false)
    setSearch('')
  }

  const updateQty = (idx: number, qty: number) => {
    const next = [...value]
    next[idx] = { ...next[idx], quantity: Math.max(1, qty) }
    onChange(next)
  }

  const removePart = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Required Parts</p>

      {value.length === 0 && !showSearch && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 py-4 text-center text-sm text-gray-400">
          No required parts added
        </div>
      )}

      {value.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {value.map((item, idx) => {
            const overstocked = item.part && item.quantity > item.part.quantity_on_hand
            return (
              <div key={idx} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {item.part?.name ?? `Part #${item.part_id}`}
                  </p>
                  {item.part?.part_number && <p className="text-xs text-gray-400">{item.part.part_number}</p>}
                  {overstocked && (
                    <p className="text-xs text-orange-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Only {item.part?.quantity_on_hand} in stock (need {item.quantity})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Qty:</span>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                    className={cn('w-14 rounded border px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500',
                      overstocked ? 'border-orange-400 dark:border-orange-600' : 'border-gray-200 dark:border-gray-700',
                      'bg-transparent text-gray-900 dark:text-gray-100')}
                  />
                </div>
                <button type="button" onClick={() => removePart(idx)} className="text-gray-300 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showSearch ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2">
          <input
            autoFocus
            type="text"
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addPart(p)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
              >
                <span className="text-gray-900 dark:text-gray-100">{p.name} <span className="text-xs text-gray-400 ml-1">{p.part_number}</span></span>
                <span className="text-xs text-gray-400">{p.quantity_on_hand} in stock</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-2 py-1">No matching parts</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setShowSearch(false); setSearch('') }} className="w-full">Cancel</Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowSearch(true)} className="w-full">
          <Plus className="h-4 w-4 mr-1" />Add Part
        </Button>
      )}
    </div>
  )
}
