import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAssignWorkOrder, useTransitionWorkOrder } from '@/hooks/useWorkOrders'

interface AssignModalProps {
  workOrderId: number
  open: boolean
  onClose: () => void
}

// Temporary user list — replace with useUsers() hook when available
const MOCK_TECHNICIANS = [
  { id: 2, full_name: 'Carlos Tech' },
  { id: 3, full_name: 'Dana Tech' },
  { id: 4, full_name: 'Eve Tech' },
]

export function AssignModal({ workOrderId, open, onClose }: AssignModalProps) {
  const [assigneeId, setAssigneeId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const assign = useAssignWorkOrder()
  const transition = useTransitionWorkOrder()

  const handleAssign = async () => {
    if (!assigneeId) return
    await assign.mutateAsync({ id: workOrderId, assignee_id: assigneeId })
    await transition.mutateAsync({ id: workOrderId, event: 'assign' })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Work Order">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Assignee *
          </label>
          <select
            value={assigneeId ?? ''}
            onChange={(e) => setAssigneeId(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">Select technician...</option>
            {MOCK_TECHNICIANS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Note to assignee
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Optional instructions..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!assigneeId || assign.isPending || transition.isPending}
            loading={assign.isPending || transition.isPending}
          >
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  )
}
