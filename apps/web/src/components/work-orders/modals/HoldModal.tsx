import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useTransitionWorkOrder } from '@/hooks/useWorkOrders'

interface HoldModalProps {
  workOrderId: number
  open: boolean
  onClose: () => void
}

const HOLD_REASONS = [
  'Waiting for parts',
  'Waiting for access',
  'Waiting for approval',
  'Other',
]

export function HoldModal({ workOrderId, open, onClose }: HoldModalProps) {
  const [reason, setReason] = useState(HOLD_REASONS[0])
  const [other, setOther] = useState('')
  const [resumeDate, setResumeDate] = useState('')
  const transition = useTransitionWorkOrder()

  const handleHold = async () => {
    const finalReason = reason === 'Other' ? other.trim() : reason
    await transition.mutateAsync({
      id: workOrderId,
      event: 'hold',
      payload: { work_order: { hold_reason: finalReason, expected_resume_date: resumeDate || undefined } },
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Put Work Order On Hold">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Reason for hold *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {HOLD_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {reason === 'Other' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Specify reason *
            </label>
            <textarea
              value={other}
              onChange={(e) => setOther(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Expected resume date
          </label>
          <input
            type="date"
            value={resumeDate}
            onChange={(e) => setResumeDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleHold}
            disabled={
              (reason === 'Other' && !other.trim()) || transition.isPending
            }
            loading={transition.isPending}
          >
            Put On Hold
          </Button>
        </div>
      </div>
    </Modal>
  )
}
