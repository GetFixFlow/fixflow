import { Package } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useWorkOrderParts } from '@/hooks/useWorkOrders'

interface WorkOrderPartsLogProps {
  workOrderId: number
  editable?: boolean
  onAddPart?: () => void
}

export function WorkOrderPartsLog({ workOrderId, editable = false, onAddPart }: WorkOrderPartsLogProps) {
  const { data: parts = [], isLoading } = useWorkOrderParts(workOrderId)

  const total = parts.reduce((sum, p) => sum + p.total_cost, 0)

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {parts.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Part</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {parts.map((p) => (
                <tr key={p.id} className="bg-white dark:bg-gray-900">
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                    {p.part.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    {p.part.part_number ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                    {p.quantity_used}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                    ${p.unit_cost.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                    ${p.total_cost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 dark:border-gray-700">
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td colSpan={4} className="px-3 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                  Total parts cost:
                </td>
                <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                  ${total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm italic text-gray-400 dark:text-gray-500">No parts logged yet.</p>
      )}

      {editable && (
        <Button variant="outline" size="sm" onClick={onAddPart}>
          <Package className="h-4 w-4" />
          Log Part Used
        </Button>
      )}
    </div>
  )
}
