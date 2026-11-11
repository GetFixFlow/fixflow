import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { AlertSeverityBadge } from './AlertSeverityBadge'
import type { IotAlertExtended } from '@/types'

interface IoTAlertsListProps {
  alerts: IotAlertExtended[]
  onAcknowledge?: (id: number) => void
  onResolve?: (id: number) => void
  onRowClick?: (alert: IotAlertExtended) => void
  compact?: boolean
  maxItems?: number
}

function normalizeSeverity(s: string): 'critical' | 'high' | 'medium' | 'low' {
  if (s === 'warning') return 'high'
  if (s === 'info') return 'low'
  return s as 'critical' | 'high' | 'medium' | 'low'
}

export function IoTAlertsList({ alerts, onAcknowledge, onResolve, onRowClick, compact, maxItems }: IoTAlertsListProps) {
  const shown = maxItems ? alerts.slice(0, maxItems) : alerts

  if (shown.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-green-700 dark:text-green-400">
        <span className="text-2xl">✅</span>
        <span className="text-sm font-medium">No alerts</span>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {shown.map((alert) => {
        const sev = normalizeSeverity(alert.severity)
        return (
          <div key={alert.id}
            className={cn('flex items-center gap-3 px-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
              sev === 'critical' && alert.status === 'open' && 'animate-pulse-subtle')}>
            {/* The row opens the alert: a button, so the keyboard reaches it; the Ack button beside it is its own control. */}
            <button type="button" onClick={() => onRowClick?.(alert)}
              className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <AlertSeverityBadge severity={sev} size="sm" />
              <span className="block min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{alert.rule_name ?? alert.message}</span>
                {!compact && (
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{alert.asset?.name ?? `Asset ${alert.asset_id}`} · {alert.metric_name} = {alert.sensor_value} {alert.metric_unit}</span>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
              </span>
            </button>
            {!compact && alert.status === 'open' && onAcknowledge && (
              <button onClick={() => onAcknowledge(alert.id)}
                className="shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline">Ack</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
