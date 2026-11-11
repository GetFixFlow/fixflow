import { useTranslation } from 'react-i18next'
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

const RESOLUTION_OPTIONS: ResolutionType[] = ['fully_resolved', 'temporarily_resolved', 'partially_resolved']

export function CompleteModal({
  workOrderId,
  checklistItems = [],
  open,
  onClose,
}: CompleteModalProps) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState('')
  const [hours, setHours] = useState('')
  const [resolution, setResolution] = useState<ResolutionType>('fully_resolved')
  const complete = useCompleteWorkOrder()

  const requiredIncomplete = checklistItems.filter((i) => i.required !== false && !i.completed)

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
    <Modal open={open} onClose={onClose} title={t('workOrders.complete.title')}>
      <div className="space-y-4">
        {requiredIncomplete.length > 0 && (
          <div className="rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>{t('workOrders.complete.unchecked', { count: requiredIncomplete.length })}</strong>
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {requiredIncomplete.map((i) => (
                    <li key={i.step}>{i.instruction}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('workOrders.complete.notes')} <span className="text-xs text-gray-400">{t('workOrders.complete.notes_min')}</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder={t('workOrders.complete.notes_placeholder')}
          />
          <p className="mt-0.5 text-xs text-gray-400">{t('workOrders.complete.chars', { count: notes.length })}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('workOrders.complete.hours')}
          </label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder={t('workOrders.complete.hours_placeholder')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('workOrders.complete.resolution')}
          </label>
          <div className="space-y-2">
            {RESOLUTION_OPTIONS.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="resolution"
                  value={opt}
                  checked={resolution === opt}
                  onChange={() => setResolution(opt)}
                  className="text-brand-600 focus:ring-brand-500"
                />
                {t(`workOrders.complete.resolution_${opt}`)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || complete.isPending}
            loading={complete.isPending}
          >
            {t('workOrders.complete.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
