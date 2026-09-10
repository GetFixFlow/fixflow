import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useCompleteWorkOrder } from '@/hooks/useWorkOrders'
import type { ChecklistItem, ResolutionType } from '@/types'

interface CompleteModalProps {
  workOrderId: number
  checklistItems?: ChecklistItem[]
  open: boolean
  onClose: () => void
}

const RESOLUTION_OPTIONS: { value: ResolutionType; label: string }[] = [
  { value: 'fully_resolved', label: 'Fully resolved' },
  { value: 'temporarily_resolved', label: 'Temporarily resolved (follow-up needed)' },
  { value: 'partially_resolved', label: 'Partially resolved' },
]

export function CompleteModal({
  workOrderId,
  checklistItems = [],
  open,
  onClose,
}: CompleteModalProps) {
  const [notes, setNotes] = useState('')
  const [hours, setHours] = useState('')
  const [resolution, setResolution] = useState<ResolutionType>('fully_resolved')
  const complete = useCompleteWorkOrder()

  const requiredIncomplete = checklistItems.filter((i) => i.required && !i.completed)

  const canSubmit =
    requiredIncomplete.length === 0 &&
    notes.trim().length >= 20 &&
    Number(hours) > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    await complete.mutateAsync({
      id: workOrderId,
      completion_notes: notes.trim(),
      actual_hours: Number(hours),
      resolution_type: resolution,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark as Complete">
      <div className="space-y-4">
        {requiredIncomplete.length > 0 && (
          <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>{requiredIncomplete.length} required step{requiredIncomplete.length !== 1 && 's'} not checked:</strong>
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {requiredIncomplete.map((i) => (
                    <li key={i.id}>{i.description}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Completion Notes * <span className="text-xs text-gray-400">(min 20 chars)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Describe what was done..."
          />
          <p className="mt-0.5 text-xs text-gray-400">{notes.length} chars</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Actual Hours *
          </label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="e.g. 1.5"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Resolution Type
          </label>
          <div className="space-y-2">
            {RESOLUTION_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="resolution"
                  value={opt.value}
                  checked={resolution === opt.value}
                  onChange={() => setResolution(opt.value)}
                  className="text-brand-600 focus:ring-brand-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || complete.isPending}
            loading={complete.isPending}
          >
            Mark Complete
          </Button>
        </div>
      </div>
    </Modal>
  )
}
