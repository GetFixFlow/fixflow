import { label } from '@/i18n'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList,
  Package,
  Wrench,
  Radio,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/ui/StatCard'
import { StatCardSkeleton } from '@/components/ui/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, statusBadge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/localeFormat'
import { GettingStarted } from '@/components/dashboard/GettingStarted'
import { RequesterDashboard, TechnicianDashboard } from '@/components/dashboard/RoleDashboards'

export function DashboardPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useDashboard()
  const { user } = useAuthStore()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('dashboard.title')} description={t('dashboard.overview')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  // The server decides what each kind of person sees (see DashboardResponse); a technician or requester has no
  // company-wide figures to draw.
  if ('my_requests' in data) return <RequesterDashboard data={data} name={user?.full_name} />
  if ('my_work_orders' in data) return <TechnicianDashboard data={data} name={user?.full_name} />

  const assetsByStatus = [
    { name: label('status', 'operational'), value: data.assets.operational },
    { name: label('status', 'degraded'), value: data.assets.degraded },
    { name: label('status', 'down'), value: data.assets.down },
    { name: label('status', 'decommissioned'), value: data.assets.decommissioned },
  ].filter((entry) => entry.value > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.welcome', { name: user?.full_name?.split(' ')[0] })}
        description={t('dashboard.happening')}
      />

      {/* The administrator's first steps, and a note when what is shown is sample data */}
      {user?.role === 'admin' && <GettingStarted />}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('dashboard.open_wo')}
          value={data.work_orders.open}
          subtitle={t('dashboard.n_overdue', { count: data.work_orders.overdue })}
          icon={ClipboardList}
        />
        <StatCard
          title={t('dashboard.asset_health')}
          value={`${data.assets.health_score}%`}
          subtitle={t('dashboard.n_operational', { operational: data.assets.operational, total: data.assets.total })}
          icon={Package}
          iconClassName={data.assets.health_score < 80 ? 'bg-red-50 dark:bg-red-900/20' : undefined}
        />
        <StatCard
          title={t('dashboard.pm_compliance')}
          value={data.preventive_maintenance.compliance_rate_30d === null ? '—' : `${data.preventive_maintenance.compliance_rate_30d}%`}
          subtitle={t('dashboard.n_overdue_schedules', { count: data.preventive_maintenance.overdue })}
          icon={Wrench}
        />
        <StatCard
          title={t('dashboard.iot_alerts')}
          value={data.iot.open_alerts}
          subtitle={t('dashboard.n_critical', { count: data.iot.critical_alerts })}
          icon={Radio}
          iconClassName={data.iot.critical_alerts > 0 ? 'bg-red-50 dark:bg-red-900/20' : undefined}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <CheckCircle className="h-5 w-5 text-green-700 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.completed_week')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {data.work_orders.completed_this_week}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <Clock className="h-5 w-5 text-yellow-700 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.due_week')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {data.preventive_maintenance.due_this_week}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.in_progress')}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {data.work_orders.in_progress}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts — only for manager+ */}
      {(user?.role === 'admin' || user?.role === 'manager') && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.asset_breakdown')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={assetsByStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.recent')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recent_activity.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.no_activity')}</p>
              ) : (
                <ul className="space-y-3">
                  {data.recent_activity.map((activity, index) => (
                    <li key={index} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {activity.description}
                        </span>
                        <span className="ml-2 text-gray-500 dark:text-gray-400">{activity.type.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(activity.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Asset status summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.asset_overview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries({
              operational: data.assets.operational,
              degraded: data.assets.degraded,
              down: data.assets.down,
              decommissioned: data.assets.decommissioned,
            }).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <Badge variant={statusBadge(status)}>{label('status', status)}</Badge>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
