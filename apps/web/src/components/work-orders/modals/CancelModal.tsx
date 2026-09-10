import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useTransitionWorkOrder } from '@/hooks/useWorkOrders'

interface CancelModalProps {
  workOrderId: number
  open: boolean
  onClose: () => void
}

export function CancelModal({ workOrderId, open, onClose }: CancelModalProps) {
  const [reason, setReason] = useState('')
  const transition = useTransitionWorkOrder()

  const canSubmit = reason.trim().length > 0

  const handleCancel = async () => {
    if (!canSubmit) return
    await transition.mutateAsync({
      id: workOrderId,
      event: 'cancel',
      payload: { work_order: { cancellation_reason: reason.trim() } },
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Cancel Work Order">
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 dark:bg-red-900/20">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">
            This action cannot be undone.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Cancellation reason *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Why is this work order being cancelled?"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Keep Open
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={!canSubmit || transition.isPending}
            loading={transition.isPending}
          >
            Cancel Work Order
          </Button>
        </div>
      </div>
    </Modal>
  )
}
