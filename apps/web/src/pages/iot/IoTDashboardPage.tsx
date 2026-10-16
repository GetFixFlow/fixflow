import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wifi, Bell, Plus, Settings } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { useIotDashboard, useIotAlerts, useAcknowledgeAlert } from '@/hooks/useIoT'
import { useRealtimeStore } from '@/stores/realtimeStore'
import { useAuthStore } from '@/stores/authStore'
import { IoTAlertCard } from '@/components/iot/IoTAlertCard'
import { IoTAlertsList } from '@/components/iot/IoTAlertsList'
import { AssetSensorGrid } from '@/components/iot/AssetSensorGrid'
import { ReadingsActivityChart } from '@/components/iot/ReadingsActivityChart'
import type { IotAlertExtended } from '@/types'

type SeverityTab = 'critical' | 'high' | 'medium' | 'all'

export function IoTDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const { data: dashboard, isLoading: dashLoading, isError: dashError, refetch, dataUpdatedAt } = useIotDashboard()
  const { data: alertsData } = useIotAlerts({ status: 'open' })
  const { mutate: acknowledge } = useAcknowledgeAlert()

  const connected = useRealtimeStore((s) => s.connected)

  const [now, setNow] = useState(() => Date.now())
  const [severityTab, setSeverityTab] = useState<SeverityTab>('all')

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const openAlerts = (alertsData?.iot_alerts ?? []) as IotAlertExtended[]

  const filteredAlerts = severityTab === 'all'
    ? openAlerts
    : openAlerts.filter((a) => {
        const norm = a.severity === 'warning' ? 'high' : a.severity === 'info' ? 'low' : a.severity
        return norm === severityTab
      })

  // When the figures were really fetched, not how long this page has been open.
  const secondsAgo = dataUpdatedAt ? Math.max(0, Math.floor((now - dataUpdatedAt) / 1000)) : null
  const updatedLabel = secondsAgo === null
    ? 'Not loaded yet'
    : secondsAgo < 60 ? `Updated ${secondsAgo}s ago` : `Updated ${Math.floor(secondsAgo / 60)}m ago`

  return (
    <div className="space-y-6">
      <PageHeader
        title="IoT Monitor"
        description={
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400')} />
            {connected ? 'Live' : 'Offline'} · {updatedLabel}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link to="/iot/rules">
              <Button variant="outline">Manage Rules</Button>
            </Link>
            {isManager && (
              <Link to="/settings/api-keys">
                <Button variant="outline"><Settings className="h-4 w-4 mr-1.5" />API Keys</Button>
              </Link>
            )}
            {isManager && (
              <Link to="/iot/rules/new">
                <Button><Plus className="h-4 w-4 mr-1.5" />Add IoT Rule</Button>
              </Link>
            )}
          </div>
        }
      />

      {dashError && !dashboard && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <span>The IoT figures could not be loaded. The open alerts below may still be up to date.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      )}

      {/* Stat cards */}
      {(dashLoading || dashboard) && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {dashLoading || !dashboard ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard title="Active Sensors" value={dashboard.active_sensors} icon={Wifi} subtitle={`${dashboard.monitored_assets} assets monitored`} />
            <StatCard title="Readings/Hour" value={dashboard.readings_per_hour} trend={{ value: dashboard.readings_per_hour_change, label: 'vs last hour' }} />
            <StatCard
              title="Open Alerts"
              value={dashboard.open_alerts}
              icon={Bell}
              iconClassName={dashboard.critical_alerts > 0 ? 'bg-red-100 dark:bg-red-900/20 animate-pulse' : undefined}
              subtitle={dashboard.critical_alerts > 0 ? `${dashboard.critical_alerts} critical` : 'All clear'}
              className={dashboard.critical_alerts > 0 ? 'border-red-200 dark:border-red-800' : ''}
            />
            <StatCard title="Active Rules" value={dashboard.active_rules} subtitle={dashboard.triggered_rules > 0 ? `${dashboard.triggered_rules} triggered today` : 'No triggers today'} />
          </>
        )}
      </div>}

      {/* Open Alerts panel */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Open Alerts</h2>
            <Link to="/iot/alerts" className="text-sm text-brand-600 hover:underline">View All →</Link>
          </div>

          {/* Severity tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { id: 'critical' as SeverityTab, label: '🔴 Critical', count: dashboard?.critical_alerts ?? 0 },
              { id: 'high' as SeverityTab, label: '🟠 High', count: dashboard?.high_alerts ?? 0 },
              { id: 'medium' as SeverityTab, label: '🟡 Medium', count: dashboard?.medium_alerts ?? 0 },
              { id: 'all' as SeverityTab, label: 'All', count: dashboard?.open_alerts ?? openAlerts.length },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSeverityTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  severityTab === tab.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
                )}
              >
                {tab.label}
                {tab.count > 0 && <span className="rounded-full bg-white/20 px-1.5">{tab.count}</span>}
              </button>
            ))}
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="text-center py-8 text-green-600 dark:text-green-400">
              <span className="text-2xl">✅</span>
              <p className="text-sm font-medium mt-1">No alerts</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {filteredAlerts.slice(0, 5).map((alert) => (
                <IoTAlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={(id) => acknowledge(id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asset Sensor Grid */}
      {dashboard && dashboard.asset_status.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Asset Status</h2>
          <AssetSensorGrid assetStatus={dashboard.asset_status} isLoading={dashLoading} />
        </div>
      )}

      {/* Readings Activity Chart */}
      {(dashLoading || dashboard) && (
        <Card>
          <CardContent className="p-4">
            <ReadingsActivityChart data={dashboard?.hourly_readings ?? []} isLoading={dashLoading} />
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts feed */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Alerts</h2>
            <Link to="/iot/alerts" className="text-sm text-brand-600 hover:underline">View All Alerts →</Link>
          </div>
          <IoTAlertsList
            alerts={openAlerts}
            maxItems={20}
            onRowClick={(a) => navigate('/iot/alerts')}
            onAcknowledge={(id) => acknowledge(id)}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export { IoTDashboardPage as IotPage }
