import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useTransitionWorkOrder } from '@/hooks/useWorkOrders'

interface HoldModalProps {
  workOrderId: number
  open: boolean
  onClose: () => void
}

const HOLD_REASONS = ['parts', 'access', 'approval', 'other'] as const

export function HoldModal({ workOrderId, open, onClose }: HoldModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState<string>(HOLD_REASONS[0])
  const [other, setOther] = useState('')
  const [resumeDate, setResumeDate] = useState('')
  const transition = useTransitionWorkOrder()

  const handleHold = async () => {
    const finalReason = reason === 'other' ? other.trim() : t(`workOrders.hold.reason_${reason}`)
    await transition.mutateAsync({
      id: workOrderId,
      event: 'hold',
      payload: { work_order: { hold_reason: finalReason, expected_resume_date: resumeDate || undefined } },
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('workOrders.hold.title')}>
      <div className="space-y-4">
        <div>
          <label htmlFor="hold-1" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('workOrders.hold.reason')}
          </label>
          <select id="hold-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {HOLD_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`workOrders.hold.reason_${r}`)}
              </option>
            ))}
          </select>
        </div>

        {reason === 'other' && (
          <div>
            <label htmlFor="hold-2" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('workOrders.hold.specify')}
            </label>
            <textarea id="hold-2"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        )}

        <div>
          <label htmlFor="hold-3" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('workOrders.hold.resume')}
          </label>
          <input id="hold-3"
            type="date"
            value={resumeDate}
            onChange={(e) => setResumeDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleHold}
            disabled={
              (reason === 'other' && !other.trim()) || transition.isPending
            }
            loading={transition.isPending}
          >
            {t('workOrders.hold.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
