import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useActiveVendors, useGiveToVendor } from '@/hooks/useVendors'
import type { WorkOrder } from '@/types'

interface VendorModalProps {
  workOrder: WorkOrder
  onClose: () => void
}

/** A manager gives the work order to a vendor, or changes what the vendor charged, or takes it off the vendor. */
export function VendorModal({ workOrder, onClose }: VendorModalProps) {
  const { t } = useTranslation()
  const { data: vendors = [], isLoading } = useActiveVendors()
  const save = useGiveToVendor(workOrder.id)
  const [vendorId, setVendorId] = useState<number | ''>(workOrder.vendor_id ?? '')
  const [cost, setCost] = useState(workOrder.vendor_cost != null ? String(Number(workOrder.vendor_cost)) : '')
  const [reference, setReference] = useState(workOrder.vendor_reference ?? '')
  const costValid = cost === '' || (Number.isFinite(Number(cost)) && Number(cost) >= 0)

  // The vendor this work order already has stays in the list even when it has since been switched off.
  const current = workOrder.vendor
  const options = current && !vendors.some((v) => v.id === current.id) ? [{ id: current.id, name: t('workOrders.vendor_modal.not_in_use', { name: current.name }) }, ...vendors] : vendors

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!costValid) return
    save.mutate(
      vendorId === '' ? { vendor_id: null, vendor_cost: 0, vendor_reference: null }
        : { vendor_id: vendorId, vendor_cost: Number(cost || 0), vendor_reference: reference.trim() || null },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal open onClose={onClose} title={t('workOrders.vendor.title')} description={t('workOrders.vendor_modal.description')}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="wo-vendor" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('workOrders.vendor.title')}</label>
          <select
            id="wo-vendor"
            value={vendorId}
            disabled={isLoading}
            onChange={(e) => setVendorId(e.target.value === '' ? '' : Number(e.target.value))}
            className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">{t('workOrders.vendor_modal.none')}</option>
            {options.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {!isLoading && vendors.length === 0 && !current && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('workOrders.vendor_modal.no_vendors')}</p>
          )}
        </div>
        {vendorId !== '' && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="wo-vendor-cost" label={t('workOrders.vendor_modal.charged')} type="number" step="0.01" min="0" placeholder="0.00"
              value={cost} onChange={(e) => setCost(e.target.value)}
              error={costValid ? undefined : t('workOrders.vendor_modal.amount_error')}
            />
            <Input id="wo-vendor-ref" label={t('workOrders.vendor_modal.reference')} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.actions.cancel')}</Button>
          <Button type="submit" disabled={save.isPending || !costValid} className="flex-1">{save.isPending ? t('common.actions.saving') : t('common.actions.save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
