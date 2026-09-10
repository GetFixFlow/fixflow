import { useState } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { AlertSeverityBadge } from './AlertSeverityBadge'
import type { IotAlertExtended } from '@/types'

interface AlertDetailPanelProps {
  alert: IotAlertExtended | null
  onClose: () => void
  onAcknowledge?: (id: number, note?: string) => void
  onResolve?: (id: number, note?: string) => void
}

export function AlertDetailPanel({ alert, onClose, onAcknowledge, onResolve }: AlertDetailPanelProps) {
  const [ackNote, setAckNote] = useState('')
  const [resolveNote, setResolveNote] = useState('')

  const isOpen = !!alert
  const sev = (
    alert?.severity === 'warning' ? 'high' :
    alert?.severity === 'info' ? 'low' :
    (alert?.severity ?? 'low')
  ) as 'critical' | 'high' | 'medium' | 'low'

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-96 bg-white shadow-2xl dark:bg-gray-900 transition-transform duration-300 flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-2">
            {alert && <AlertSeverityBadge severity={sev} />}
            <span className="text-xs text-gray-400">#{alert?.id}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {alert && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Rule / Message */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {alert.rule_name ?? alert.message}
              </h2>
              {alert.message && alert.rule_name && alert.message !== alert.rule_name && (
                <p className="text-sm text-gray-500 mt-0.5">{alert.message}</p>
              )}
            </div>

            {/* Asset info */}
            {alert.asset ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Asset</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{alert.asset.name}</p>
                    <p className="text-xs text-gray-500">{alert.asset.asset_tag}</p>
                  </div>
                  <Link to={`/assets/${alert.asset_id}`} onClick={onClose}>
                    <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Asset</p>
                <Link to={`/assets/${alert.asset_id}`} onClick={onClose} className="text-sm text-brand-600 hover:underline">
                  Asset #{alert.asset_id}
                </Link>
              </div>
            )}

            {/* Trigger details */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Trigger Details</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-500">Metric</span>
                <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{alert.metric_name}</span>
                <span className="text-gray-500">Reading</span>
                <span className="font-mono font-medium text-red-600">{alert.sensor_value} {alert.metric_unit}</span>
                <span className="text-gray-500">Threshold</span>
                <span className="font-mono text-gray-900 dark:text-gray-100">{alert.threshold_value} {alert.metric_unit}</span>
                {alert.duration_minutes != null && (
                  <>
                    <span className="text-gray-500">Duration</span>
                    <span className="text-gray-900 dark:text-gray-100">{alert.duration_minutes} min</span>
                  </>
                )}
                <span className="text-gray-500">Triggered</span>
                <span className="text-gray-900 dark:text-gray-100 text-xs">
                  {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>

            {/* Work order */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Work Order</p>
              {alert.work_order_id ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-600">
                    {alert.work_order_number ?? `WO #${alert.work_order_id}`}
                  </span>
                  <Link to={`/work-orders/${alert.work_order_id}`} onClick={onClose}>
                    <Button size="sm" variant="outline">View WO</Button>
                  </Link>
                </div>
              ) : (
                <Link to={`/work-orders/new?alert_id=${alert.id}&asset_id=${alert.asset_id}`} onClick={onClose}>
                  <Button size="sm" variant="outline" className="w-full">+ Create Work Order</Button>
                </Link>
              )}
            </div>

            {/* Resolution actions */}
            {(alert.status === 'open' || alert.status === 'acknowledged') && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase">Actions</p>

                {alert.status === 'open' && onAcknowledge && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Acknowledgment note (optional)..."
                      rows={2}
                      value={ackNote}
                      onChange={(e) => setAckNote(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => { onAcknowledge(alert.id, ackNote); setAckNote('') }}
                    >
                      Acknowledge
                    </Button>
                  </div>
                )}

                {onResolve && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Resolution note (optional)..."
                      rows={2}
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => { onResolve(alert.id, resolveNote); setResolveNote('') }}
                    >
                      Mark Resolved
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Resolved info */}
            {alert.status === 'resolved' && alert.resolved_at && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                <p className="text-xs font-medium text-green-700 dark:text-green-300">
                  Resolved {format(new Date(alert.resolved_at), 'MMM d, h:mm a')}
                </p>
                {alert.resolved_note && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">{alert.resolved_note}</p>
                )}
              </div>
            )}

            {/* Acknowledged info */}
            {alert.acknowledged_at && alert.status === 'acknowledged' && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Acknowledged {format(new Date(alert.acknowledged_at), 'MMM d, h:mm a')}
                </p>
                {alert.acknowledged_note && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{alert.acknowledged_note}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
