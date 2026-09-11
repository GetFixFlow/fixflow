import { DollarSign } from 'lucide-react'
import { useWorkOrderParts } from '@/hooks/useWorkOrders'

const HOURLY_RATE = 40 // USD per hour, configurable in settings

interface WorkOrderCostsProps {
  workOrderId: number
  actualHours?: number | string
  laborCost?: number | string
}

export function WorkOrderCosts({ workOrderId, actualHours, laborCost }: WorkOrderCostsProps) {
  const { data: parts = [] } = useWorkOrderParts(workOrderId)

  // Rails serializes decimal columns (labor_cost, actual_hours, total_cost) as
  // JSON strings to avoid float precision loss — coerce before doing math.
  const hours = actualHours != null ? Number(actualHours) : undefined
  const partsCost = parts.reduce((sum, p) => sum + Number(p.total_cost), 0)
  const labor = laborCost != null ? Number(laborCost) : (hours ? hours * HOURLY_RATE : 0)
  const total = partsCost + labor

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost Summary</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <Row label="Parts cost" value={`$${partsCost.toFixed(2)}`} />
        <Row
          label={`Labor cost${hours ? ` (${hours} hrs × $${HOURLY_RATE}/hr)` : ''}`}
          value={`$${labor.toFixed(2)}`}
        />
        <Row label="Total cost" value={`$${total.toFixed(2)}`} bold />
      </div>
    </div>
  )
}
