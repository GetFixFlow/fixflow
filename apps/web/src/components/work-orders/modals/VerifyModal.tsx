import { useState } from 'react'
import { format } from 'date-fns'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useVerifyWorkOrder } from '@/hooks/useWorkOrders'
import { useWorkOrderParts } from '@/hooks/useWorkOrders'
import type { WorkOrder } from '@/types'

interface VerifyModalProps {
  workOrder: WorkOrder
  open: boolean
  onClose: () => void
  onReject: () => void
}

const VERIFY_CHECKLIST = [
  'Work was completed as described',
  'Asset is functional and tested',
  'Area cleaned up',
  'Documentation complete',
]

export function VerifyModal({ workOrder, open, onClose, onReject }: VerifyModalProps) {
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const verify = useVerifyWorkOrder()
  const { data: parts = [] } = useWorkOrderParts(workOrder.id)

  const partsCost = parts.reduce((sum, p) => sum + p.total_cost, 0)

  const toggleCheck = (item: string) => {
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }))
  }

  const handleVerify = async () => {
    await verify.mutateAsync({ id: workOrder.id, note: note.trim() || undefined })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Verify Completion">
      <div className="space-y-4">
        {/* Summary */}
        <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1.5 dark:bg-gray-800">
          <div className="flex justify-between">
            <span className="text-gray-500">Completed by</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {workOrder.assignee?.full_name ?? '—'}
            </span>
          </div>
          {workOrder.completed_at && (
            <div className="flex justify-between">
              <span className="text-gray-500">Completed at</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {format(new Date(workOrder.completed_at), 'MMM d, yyyy HH:mm')}
              </span>
            </div>
          )}
          {workOrder.actual_hours && (
            <div className="flex justify-between">
              <span className="text-gray-500">Actual hours</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {workOrder.actual_hours} hrs
              </span>
            </div>
          )}
          {parts.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Parts used</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {parts.length} part{parts.length !== 1 && 's'} (${partsCost.toFixed(2)})
              </span>
            </div>
          )}
          {workOrder.completion_notes && (
            <div>
              <span className="text-gray-500 block">Completion notes</span>
              <p className="mt-1 text-gray-700 dark:text-gray-300 text-xs italic">
                "{workOrder.completion_notes}"
              </p>
            </div>
          )}
        </div>

        {/* Verification checklist */}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Verification checklist
          </p>
          <div className="space-y-1.5">
            {VERIFY_CHECKLIST.map((item) => (
              <label
                key={item}
                className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={checked[item] ?? false}
                  onChange={() => toggleCheck(item)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                {item}
              </label>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Verification note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Optional verification notes..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onReject} className="text-red-600">
            Reject
          </Button>
          <Button
            onClick={handleVerify}
            disabled={verify.isPending}
            loading={verify.isPending}
          >
            Verify &amp; Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
