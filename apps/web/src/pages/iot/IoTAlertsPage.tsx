import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, MoreVertical } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import {
  useIotAlerts,
  useAcknowledgeAlert,
  useResolveAlert,
  useSuppressAlert,
  useBulkAcknowledgeAlerts,
  useBulkResolveAlerts,
} from '@/hooks/useIoT'
import { useAuthStore } from '@/stores/authStore'
import { AlertDetailPanel } from '@/components/iot/AlertDetailPanel'
import { AlertSeverityBadge } from '@/components/iot/AlertSeverityBadge'
import type { IotAlertExtended } from '@/types'

type StatusTab = 'open' | 'acknowledged' | 'resolved' | 'all'

const SEV_NORM = (s: string) =>
  s === 'warning' ? 'high' : s === 'info' ? 'low' : s as 'critical' | 'high' | 'medium' | 'low'

export function IoTAlertsPage() {
  const { user } = useAuthStore()
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const [statusTab, setStatusTab] = useState<StatusTab>('open')
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<IotAlertExtended | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const { data, isLoading } = useIotAlerts()
  const acknowledge = useAcknowledgeAlert()
  const resolve = useResolveAlert()
  const suppress = useSuppressAlert()
  const bulkAck = useBulkAcknowledgeAlerts()
  const bulkResolve = useBulkResolveAlerts()

  const allAlerts = (data?.iot_alerts ?? []) as IotAlertExtended[]

  const filtered = allAlerts.filter((a) => {
    if (statusTab !== 'all' && a.status !== statusTab) return false
    if (severityFilter && SEV_NORM(a.severity) !== severityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (a.rule_name ?? a.message).toLowerCase().includes(q) ||
        a.metric_name?.toLowerCase().includes(q) ||
        String(a.asset_id).includes(q)
      )
    }
    return true
  })

  const openCount = allAlerts.filter((a) => a.status === 'open').length
  const ackedCount = allAlerts.filter((a) => a.status === 'acknowledged').length
  const resolvedCount = allAlerts.filter((a) => a.status === 'resolved').length

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)))
    }
  }

  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  return (
    <div className="space-y-6">
      <AlertDetailPanel
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onAcknowledge={(id) => { acknowledge.mutate(id); setSelectedAlert(null) }}
        onResolve={(id) => { resolve.mutate(id); setSelectedAlert(null) }}
      />

      <PageHeader
        title="IoT Alerts"
        description={`${openCount} open alert${openCount !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1.5" />Export
            </Button>
            {isManager && openCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => bulkAck.mutate(allAlerts.filter((a) => a.status === 'open').map((a) => a.id))}>
                Mark All Read
              </Button>
            )}
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search alerts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
        />
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Status tabs */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700">
        {([
          { id: 'open' as StatusTab, label: 'Open', count: openCount },
          { id: 'acknowledged' as StatusTab, label: 'Acknowledged', count: ackedCount },
          { id: 'resolved' as StatusTab, label: 'Resolved', count: resolvedCount },
          { id: 'all' as StatusTab, label: 'All', count: allAlerts.length },
        ]).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={statusTab === tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              statusTab === tab.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-xs',
                statusTab === tab.id ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-500')}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-4 py-2">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkAck.mutate([...selectedIds])}>
            Acknowledge All
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkResolve.mutate([...selectedIds])}>
            Resolve All
          </Button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-2">✅</p>
              <p className="text-sm font-medium text-green-600">No alerts</p>
              <p className="text-xs text-gray-400 mt-1">All clear!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Triggered</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filtered.map((alert) => {
                    const sev = SEV_NORM(alert.severity)
                    const isCritical = sev === 'critical' && alert.status === 'open'
                    return (
                      <tr
                        key={alert.id}
                        className={cn(
                          'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                          isCritical && 'border-l-4 border-l-red-500',
                        )}
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(alert.id)}
                            onChange={() => toggleSelect(alert.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3"><AlertSeverityBadge severity={sev} size="sm" /></td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]">
                            {alert.rule_name ?? alert.message}
                          </p>
                          {alert.asset_id && (
                            <p className="text-xs text-gray-400">Asset #{alert.asset_id}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{alert.metric_name}</td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-red-600">{alert.sensor_value} {alert.metric_unit}</td>
                        <td className="px-4 py-3 font-mono text-xs">{alert.threshold_value} {alert.metric_unit}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            alert.status === 'open' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            alert.status === 'acknowledged' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                          )}>
                            {alert.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === alert.id ? null : alert.id)}
                              className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === alert.id && (
                              <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                                {alert.status === 'open' && (
                                  <button
                                    onClick={() => { acknowledge.mutate(alert.id); setOpenMenuId(null) }}
                                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    Acknowledge
                                  </button>
                                )}
                                <button
                                  onClick={() => { resolve.mutate(alert.id); setOpenMenuId(null) }}
                                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                  Resolve
                                </button>
                                <button
                                  onClick={() => { suppress.mutate(alert.id); setOpenMenuId(null) }}
                                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                  Suppress
                                </button>
                                <hr className="my-1 border-gray-100 dark:border-gray-700" />
                                <Link
                                  to={`/iot/assets/${alert.asset_id}`}
                                  className="block px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                  onClick={() => setOpenMenuId(null)}
                                >
                                  View Asset
                                </Link>
                                {alert.work_order_id && (
                                  <Link
                                    to={`/work-orders/${alert.work_order_id}`}
                                    className="block px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                    onClick={() => setOpenMenuId(null)}
                                  >
                                    View WO
                                  </Link>
                                )}
                                {!alert.work_order_id && (
                                  <Link
                                    to={`/work-orders/new?alert_id=${alert.id}&asset_id=${alert.asset_id}`}
                                    className="block px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                    onClick={() => setOpenMenuId(null)}
                                  >
                                    Create WO
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
