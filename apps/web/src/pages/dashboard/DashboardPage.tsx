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

export function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const { user } = useAuthStore()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Overview of your maintenance operations" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const assetsByStatus = [
    { name: 'operational', value: data.assets.operational },
    { name: 'degraded', value: data.assets.degraded },
    { name: 'down', value: data.assets.down },
    { name: 'decommissioned', value: data.assets.decommissioned },
  ].filter((entry) => entry.value > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(' ')[0]}`}
        description="Here's what's happening with your maintenance operations"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Work Orders"
          value={data.work_orders.open}
          subtitle={`${data.work_orders.overdue} overdue`}
          icon={ClipboardList}
        />
        <StatCard
          title="Asset Health"
          value={`${data.assets.health_score}%`}
          subtitle={`${data.assets.operational} of ${data.assets.total} operational`}
          icon={Package}
          iconClassName={data.assets.health_score < 80 ? 'bg-red-50 dark:bg-red-900/20' : undefined}
        />
        <StatCard
          title="PM Compliance"
          value={`${data.preventive_maintenance.compliance_rate_30d}%`}
          subtitle={`${data.preventive_maintenance.overdue} overdue schedules`}
          icon={Wrench}
        />
        <StatCard
          title="IoT Alerts"
          value={data.iot.open_alerts}
          subtitle={`${data.iot.critical_alerts} critical`}
          icon={Radio}
          iconClassName={data.iot.critical_alerts > 0 ? 'bg-red-50 dark:bg-red-900/20' : undefined}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed this week</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {data.work_orders.completed_this_week}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Due this week (PM)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {data.preventive_maintenance.due_this_week}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In progress</p>
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
              <CardTitle>Asset Status Breakdown</CardTitle>
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
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recent_activity.length === 0 ? (
                <p className="text-sm text-gray-500">No recent activity</p>
              ) : (
                <ul className="space-y-3">
                  {data.recent_activity.map((activity, index) => (
                    <li key={index} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {activity.description}
                        </span>
                        <span className="ml-2 text-gray-500">{activity.type.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(activity.timestamp).toLocaleString()}
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
          <CardTitle>Asset Status Overview</CardTitle>
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
                <Badge variant={statusBadge(status)}>{status}</Badge>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
