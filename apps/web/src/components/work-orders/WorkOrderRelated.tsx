import { Link } from 'react-router-dom'
import { RefreshCw, Zap, ClipboardList } from 'lucide-react'
import type { WorkOrder } from '@/types'

interface WorkOrderRelatedProps {
  workOrder: WorkOrder
}

export function WorkOrderRelated({ workOrder }: WorkOrderRelatedProps) {
  const hasRelated = workOrder.pm_id || workOrder.iot_alert_id

  if (!hasRelated) {
    return (
      <p className="text-sm italic text-gray-400 dark:text-gray-500">No related records.</p>
    )
  }

  return (
    <div className="space-y-2">
      {workOrder.pm_id && (
        <Link
          to={`/preventive-maintenance/${workOrder.pm_id}`}
          className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-sm hover:border-brand-300 hover:bg-brand-50 dark:border-gray-700 dark:hover:border-brand-600 dark:hover:bg-brand-900/10"
        >
          <RefreshCw className="h-4 w-4 text-blue-500 shrink-0" />
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200">Generated from PM schedule</p>
            <p className="text-xs text-gray-500">PM #{workOrder.pm_id}</p>
          </div>
        </Link>
      )}

      {workOrder.iot_alert_id && (
        <Link
          to={`/iot`}
          className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-sm hover:border-brand-300 hover:bg-brand-50 dark:border-gray-700 dark:hover:border-brand-600 dark:hover:bg-brand-900/10"
        >
          <Zap className="h-4 w-4 text-yellow-500 shrink-0" />
          <div>
            <p className="font-medium text-gray-800 dark:text-gray-200">Triggered by IoT alert</p>
            <p className="text-xs text-gray-500">Alert #{workOrder.iot_alert_id}</p>
          </div>
        </Link>
      )}
    </div>
  )
}
