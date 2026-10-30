import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { VendorModal } from '@/components/work-orders/modals/VendorModal'
import { formatMoney } from '@/lib/localeFormat'
import type { WorkOrder } from '@/types'

interface WorkOrderVendorProps {
  workOrder: WorkOrder
  /** Managers and administrators give the work order to a vendor and see what the vendor charged. */
  canManage: boolean
}

/** Who outside the company is doing this work. Everyone sees the name; the charge and invoice number are for managers. */
export function WorkOrderVendor({ workOrder, canManage }: WorkOrderVendorProps) {
  const [editing, setEditing] = useState(false)
  const vendor = workOrder.vendor
  const finished = ['verified', 'cancelled'].includes(workOrder.status)

  // A technician with nothing to see here is not shown an empty box.
  if (!vendor && !canManage) return null

  return (
    <section aria-label="Vendor" className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Building2 className="h-4 w-4 text-gray-400" />Vendor
        </h2>
        {canManage && !finished && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>{vendor ? 'Change' : 'Give to a vendor'}</Button>
        )}
      </div>
      {vendor ? (
        <dl className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-500 dark:text-gray-400">Company</dt>
            <dd className="text-gray-900 dark:text-gray-100">{vendor.name}</dd>
          </div>
          {canManage && workOrder.vendor_cost != null && (
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Charged</dt>
              <dd className="text-gray-900 dark:text-gray-100">{formatMoney(Number(workOrder.vendor_cost))}</dd>
            </div>
          )}
          {canManage && workOrder.vendor_reference && (
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Invoice / quote</dt>
              <dd className="text-gray-900 dark:text-gray-100">{workOrder.vendor_reference}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">Done in-house. Give it to a vendor when an outside company does the work.</p>
      )}
      {editing && <VendorModal workOrder={workOrder} onClose={() => setEditing(false)} />}
    </section>
  )
}
