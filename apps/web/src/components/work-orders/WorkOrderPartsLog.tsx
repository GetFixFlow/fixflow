import { useTranslation } from 'react-i18next'
import { Package, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useRemovePart, useWorkOrderParts } from '@/hooks/useWorkOrders'
import { partLineTotal } from '@/utils/parts'
import { formatMoney } from '@/lib/localeFormat'

interface WorkOrderPartsLogProps {
  workOrderId: number
  editable?: boolean
  onAddPart?: () => void
}

export function WorkOrderPartsLog({ workOrderId, editable = false, onAddPart }: WorkOrderPartsLogProps) {
  const { t } = useTranslation()
  const { data: parts = [], isLoading } = useWorkOrderParts(workOrderId)
  const removePart = useRemovePart(workOrderId)

  const total = parts.reduce((sum, p) => sum + partLineTotal(p), 0)

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
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('workOrders.parts.part')}</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{t('workOrders.parts.sku')}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{t('workOrders.parts.qty')}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{t('workOrders.parts.unit')}</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{t('workOrders.parts.total')}</th>
                {editable && <th className="w-10 px-3 py-2"><span className="sr-only">{t('common.actions.remove')}</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {parts.map((p) => (
                <tr key={p.id} className="bg-white dark:bg-gray-900">
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                    {p.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {p.sku ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                    {p.quantity_used}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                    {formatMoney(p.unit_cost ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatMoney(partLineTotal(p))}
                  </td>
                  {editable && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        aria-label={t('workOrders.parts.remove', { name: p.name })}
                        disabled={removePart.isPending}
                        onClick={() => removePart.mutate(p.id)}
                        className="text-gray-300 hover:text-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 dark:border-gray-700">
              <tr className="bg-gray-50 dark:bg-gray-800">
                <td colSpan={4} className="px-3 py-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('workOrders.parts.total_cost')}
                </td>
                <td className="px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                  {formatMoney(total)}
                </td>
                {editable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-sm italic text-gray-500 dark:text-gray-400">{t('workOrders.parts.none')}</p>
      )}

      {editable && (
        <Button variant="outline" size="sm" onClick={onAddPart}>
          <Package className="h-4 w-4" />
          {t('workOrders.parts.log')}
        </Button>
      )}
    </div>
  )
}
