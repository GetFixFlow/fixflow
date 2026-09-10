import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useRejectWorkOrder } from '@/hooks/useWorkOrders'

interface RejectModalProps {
  workOrderId: number
  currentAssigneeId?: number
  open: boolean
  onClose: () => void
}

const MOCK_TECHNICIANS = [
  { id: 2, full_name: 'Carlos Tech' },
  { id: 3, full_name: 'Dana Tech' },
  { id: 4, full_name: 'Eve Tech' },
]

export function RejectModal({ workOrderId, currentAssigneeId, open, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('')
  const [reassignTo, setReassignTo] = useState<number | null>(currentAssigneeId ?? null)
  const reject = useRejectWorkOrder()

  const canSubmit = reason.trim().length >= 20

  const handleReject = async () => {
    if (!canSubmit) return
    await reject.mutateAsync({
      id: workOrderId,
      reason: reason.trim(),
      reassign_to: reassignTo ?? undefined,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Reject Completion">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Rejection Reason * <span className="text-xs text-gray-400">(min 20 chars)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Explain why this work order cannot be verified..."
          />
          <p className="mt-0.5 text-xs text-gray-400">{reason.length} chars</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Re-assign to
          </label>
          <select
            value={reassignTo ?? ''}
            onChange={(e) => setReassignTo(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">Keep current assignee</option>
            {MOCK_TECHNICIANS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={!canSubmit || reject.isPending}
            loading={reject.isPending}
          >
            Reject &amp; Return
          </Button>
        </div>
      </div>
    </Modal>
  )
}
