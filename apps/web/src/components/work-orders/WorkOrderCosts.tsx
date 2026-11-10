import { useTranslation } from 'react-i18next'
import { DollarSign } from 'lucide-react'
import { useWorkOrderParts } from '@/hooks/useWorkOrders'
import { partLineTotal } from '@/utils/parts'
import { formatMoney } from '@/lib/localeFormat'

interface WorkOrderCostsProps {
  workOrderId: number
  actualHours?: number | string | null
  /** Worked out by the server from the hours and the hourly rate. Not sent to people who may not see wages. */
  laborCost?: number | string | null
  /** The hourly rate the labor cost was worked out at. */
  laborRate?: number | string | null
  /** What an outside company charged. Sent to managers and administrators only, like the labor cost. */
  vendorCost?: number | string | null
}

const Row = ({ label, value, bold, note }: { label: string; value: string; bold?: boolean; note?: string }) => (
  <div className={bold ? 'font-semibold' : ''}>
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value}</span>
    </div>
    {note && <p className="pb-1.5 text-xs font-normal text-amber-600 dark:text-amber-400">{note}</p>}
  </div>
)

export function WorkOrderCosts({ workOrderId, actualHours, laborCost, laborRate, vendorCost }: WorkOrderCostsProps) {
  const { t } = useTranslation()
  const { data: parts = [] } = useWorkOrderParts(workOrderId)

  // Rails serializes decimal columns as JSON strings to avoid float precision loss: coerce before doing math.
  const partsCost = parts.reduce((sum, p) => sum + partLineTotal(p), 0)
  const canSeeLabor = laborCost != null
  const hours = actualHours != null ? Number(actualHours) : 0
  const rate = laborRate != null ? Number(laborRate) : 0
  const labor = canSeeLabor ? Number(laborCost) : 0
  const vendor = vendorCost != null ? Number(vendorCost) : 0

  const laborLabel =
    hours > 0 && rate > 0
      ? t('workOrders.costs.labor_rate', { hours, rate: formatMoney(rate) })
      : hours > 0 ? t('workOrders.costs.labor_hours', { hours }) : t('workOrders.costs.labor')
  const noRate = canSeeLabor && hours > 0 && rate === 0

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('workOrders.costs.summary')}</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <Row label={t('workOrders.costs.parts')} value={formatMoney(partsCost)} />
        {canSeeLabor && (
          <>
            <Row
              label={laborLabel}
              value={formatMoney(labor)}
              note={noRate ? t('workOrders.costs.no_rate') : undefined}
            />
            {vendor > 0 && <Row label={t('workOrders.costs.vendor')} value={formatMoney(vendor)} />}
            <Row label={t('workOrders.costs.total')} value={formatMoney(partsCost + labor + vendor)} bold />
          </>
        )}
      </div>
    </div>
  )
}
