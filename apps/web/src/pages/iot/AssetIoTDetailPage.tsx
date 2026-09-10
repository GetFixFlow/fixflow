import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { useAsset } from '@/hooks/useAssets'
import {
  useIotRules,
  useAssetAlertHistory,
  useAssetReadings,
  usePauseIotRule,
  useResumeIotRule,
} from '@/hooks/useIoT'
import { useRealtimeReadings } from '@/hooks/useRealtimeReadings'
import { LiveMetricCard } from '@/components/iot/LiveMetricCard'
import { IoTAlertsList } from '@/components/iot/IoTAlertsList'
import { SensorTimeSeriesChart } from '@/components/iot/SensorTimeSeriesChart'
import type { IotRuleExtended, IotAlertExtended, SensorReading } from '@/types'

const STATUS_BADGE: Record<string, string> = {
  operational: 'default', maintenance: 'warning', offline: 'destructive', retired: 'secondary',
}

export function AssetIoTDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const assetId = Number(id)

  const [readingsOpen, setReadingsOpen] = useState(false)
  const [readingsPage, setReadingsPage] = useState(1)
  const PER_PAGE = 25

  const { data: asset, isLoading: assetLoading } = useAsset(assetId)
  const { data: rulesData, isLoading: rulesLoading } = useIotRules({ asset_id: assetId })
  const { data: historyData } = useAssetAlertHistory(assetId)
  const { data: readingsData } = useAssetReadings(assetId, { per_page: 100 })
  const pauseRule = usePauseIotRule()
  const resumeRule = useResumeIotRule()

  // Build thresholds map from rules
  const rules = (rulesData?.iot_rules ?? []) as IotRuleExtended[]
  const thresholds: Record<string, { value: number; operator: string }> = {}
  for (const r of rules) {
    if (r.metric_name && r.operator !== 'outside_range') {
      thresholds[r.metric_name] = { value: r.threshold_value, operator: r.operator }
    }
  }

  const { readings, latest, isBreached, isStale } = useRealtimeReadings(assetId, thresholds)

  const alerts = (historyData?.iot_alerts ?? []) as IotAlertExtended[]
  const rawReadings = (readingsData?.sensor_readings ?? []) as SensorReading[]
  const metrics = Object.keys(readings)

  const paginatedReadings = rawReadings.slice((readingsPage - 1) * PER_PAGE, readingsPage * PER_PAGE)
  const totalPages = Math.ceil(rawReadings.length / PER_PAGE)

  const handleExportCSV = () => {
    const header = 'timestamp,metric,value,unit,source,device_id'
    const rows = rawReadings.map((r) =>
      `${r.recorded_at},${r.sensor_type},${r.value},${r.unit},,`
    ).join('\n')
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `asset-${assetId}-readings.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (assetLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  if (!asset) {
    return <div className="text-center py-20 text-gray-500">Asset not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{asset.name}</h1>
            <Badge variant={STATUS_BADGE[asset.status] as 'default' | 'warning' | 'destructive'}>{asset.status}</Badge>
          </div>
          <p className="text-sm text-gray-500">{asset.asset_tag}</p>
        </div>
        <Link to={`/iot/rules/new?asset_id=${assetId}`}>
          <Button><Plus className="h-4 w-4 mr-1.5" />Add IoT Rule</Button>
        </Link>
      </div>

      {/* Live readings */}
      {metrics.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Live Readings</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => {
              const rule = rules.find((r) => r.metric_name === metric)
              return (
                <LiveMetricCard
                  key={metric}
                  metricName={metric}
                  unit={rule?.metric_unit}
                  readings={readings[metric] ?? []}
                  threshold={rule?.threshold_value}
                  operator={rule?.operator}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Time series chart */}
      {metrics.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <SensorTimeSeriesChart assetId={assetId} metrics={metrics} />
          </CardContent>
        </Card>
      )}

      {/* 60/40 split: alerts + rules */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Alert history (60%) */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Alert History</h2>
              <IoTAlertsList alerts={alerts} compact />
            </CardContent>
          </Card>
        </div>

        {/* Rules panel (40%) */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">IoT Rules</h2>
                <Link to={`/iot/rules/new?asset_id=${assetId}`}>
                  <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Add Rule</Button>
                </Link>
              </div>

              {rulesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No rules yet</p>
                  <Link to={`/iot/rules/new?asset_id=${assetId}`}>
                    <Button size="sm" variant="outline" className="mt-2">Add First Rule</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => {
                    const opLabel = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=', outside_range: '↔' }[rule.operator] ?? rule.operator
                    return (
                      <div key={rule.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${rule.status === 'active' ? 'bg-green-500' : rule.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[140px]">{rule.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <Link to={`/iot/rules/${rule.id}/edit`}>
                              <button className="text-xs text-gray-400 hover:text-brand-600 px-1">Edit</button>
                            </Link>
                            <button
                              onClick={() => rule.status === 'active' ? pauseRule.mutate(rule.id) : resumeRule.mutate(rule.id)}
                              className="text-xs text-gray-400 hover:text-brand-600 px-1"
                            >
                              {rule.status === 'active' ? 'Pause' : 'Resume'}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 font-mono">
                          {rule.metric_name} {opLabel} {rule.threshold_value} {rule.metric_unit}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Raw readings table (collapsible) */}
      <Card>
        <CardContent className="p-4">
          <button
            onClick={() => setReadingsOpen((v) => !v)}
            className="flex items-center justify-between w-full"
          >
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Raw Readings ({rawReadings.length})
            </h2>
            {readingsOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>

          {readingsOpen && (
            <div className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={handleExportCSV}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Timestamp</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Metric</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Value</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {paginatedReadings.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1.5 pr-4 text-xs text-gray-500">
                          {formatDistanceToNow(new Date(r.recorded_at), { addSuffix: true })}
                        </td>
                        <td className="py-1.5 pr-4 text-xs font-mono">{r.sensor_type}</td>
                        <td className="py-1.5 pr-4 text-xs font-mono font-medium">{r.value}</td>
                        <td className="py-1.5 pr-4 text-xs text-gray-500">{r.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <button
                    onClick={() => setReadingsPage((p) => Math.max(1, p - 1))}
                    disabled={readingsPage === 1}
                    className="px-2 py-1 rounded border disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span>Page {readingsPage} of {totalPages}</span>
                  <button
                    onClick={() => setReadingsPage((p) => Math.min(totalPages, p + 1))}
                    disabled={readingsPage === totalPages}
                    className="px-2 py-1 rounded border disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
