import { formatDistanceToNow } from 'date-fns'
import { MapPin, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { AlertSeverityBadge } from './AlertSeverityBadge'
import type { IotAlertExtended } from '@/types'

const BORDER_COLORS: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-50/30 dark:bg-red-900/10',
  high: 'border-l-orange-500 bg-orange-50/20 dark:bg-orange-900/10',
  medium: 'border-l-yellow-500 bg-yellow-50/20 dark:bg-yellow-900/10',
  low: 'border-l-blue-400',
  info: 'border-l-gray-400',
  warning: 'border-l-orange-500',
}

interface IoTAlertCardProps {
  alert: IotAlertExtended
  onAcknowledge?: (id: number) => void
  onResolve?: (id: number) => void
  className?: string
}

export function IoTAlertCard({ alert, onAcknowledge, onResolve, className }: IoTAlertCardProps) {
  const sev = (alert.severity === 'warning' ? 'high' : alert.severity === 'info' ? 'low' : alert.severity) as 'critical' | 'high' | 'medium' | 'low'

  return (
    <div className={cn(
      'rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 p-4 space-y-2',
      BORDER_COLORS[sev] ?? BORDER_COLORS.low,
      sev === 'critical' && 'animate-pulse-border',
      className,
    )}>
      <div className="flex items-start justify-between gap-2">
        <AlertSeverityBadge severity={sev} />
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
        </span>
      </div>

      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {alert.rule_name ?? alert.message}
        </p>
        {alert.asset && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{alert.asset.name}</p>
        )}
        {alert.metric_name && (
          <p className="text-xs text-gray-500 mt-0.5">
            Reading: <span className="font-mono font-medium">{alert.sensor_value} {alert.metric_unit}</span>
          </p>
        )}
      </div>

      {alert.location_path && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <MapPin className="h-3 w-3" />{alert.location_path}
        </p>
      )}

      {alert.work_order_number && (
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <Wrench className="h-3 w-3" />
          <Link to={`/work-orders/${alert.work_order_id}`} className="hover:underline">
            {alert.work_order_number} created automatically
          </Link>
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {alert.status === 'open' && onAcknowledge && (
          <Button size="sm" variant="outline" onClick={() => onAcknowledge(alert.id)}>Acknowledge</Button>
        )}
        {alert.asset_id && (
          <Link to={`/assets/${alert.asset_id}`}>
            <Button size="sm" variant="ghost">View Asset</Button>
          </Link>
        )}
        {alert.work_order_id && (
          <Link to={`/work-orders/${alert.work_order_id}`}>
            <Button size="sm" variant="ghost">View WO</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
