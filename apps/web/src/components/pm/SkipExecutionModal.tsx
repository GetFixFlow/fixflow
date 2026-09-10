import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertTriangle } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { useSkipExecution } from '@/hooks/usePreventiveMaintenance'
import type { PreventiveMaintenance } from '@/types'

const REASONS = [
  'Asset unavailable',
  'Parts not available',
  'Technician unavailable',
  'Work already done externally',
  'Other',
]

interface SkipExecutionModalProps {
  open: boolean
  onClose: () => void
  pmId: number
  executionId: number
  scheduledDate: string
  pm: PreventiveMaintenance
}

export function SkipExecutionModal({ open, onClose, pmId, executionId, scheduledDate, pm }: SkipExecutionModalProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const [otherText, setOtherText] = useState('')
  const skip = useSkipExecution()

  const reason = selectedReason === 'Other' ? otherText : selectedReason
  const canSubmit = !!reason.trim()

  const handleSubmit = () => {
    skip.mutate({ pmId, executionId, reason }, { onSuccess: onClose })
  }

  const nextDate = addDays(new Date(scheduledDate), (pm.frequency_value ?? 30))

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
          <div className="flex items-start justify-between mb-1">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">Skip This PM Occurrence</Dialog.Title>
            <Dialog.Close asChild><button className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button></Dialog.Close>
          </div>
          <p className="text-sm text-gray-500 mb-4">Scheduled date: {format(new Date(scheduledDate), 'MMM d, yyyy')}</p>

          <div className="space-y-2 mb-4">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="skip-reason" value={r} checked={selectedReason === r} onChange={() => setSelectedReason(r)} className="accent-brand-600" />
                {r}
              </label>
            ))}
          </div>

          {selectedReason === 'Other' && (
            <input
              autoFocus
              type="text"
              placeholder="Describe the reason..."
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
            />
          )}

          <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3 mb-4 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 dark:text-orange-300">
              Skipping will affect your compliance rate. Next occurrence: {format(nextDate, 'MMM d, yyyy')}.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              variant="secondary"
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={skip.isPending}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white border-0"
            >
              Skip This Occurrence
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
