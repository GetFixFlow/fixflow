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
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useDashboard } from '@/hooks/useDashboard'
import { useAuthStore } from '@/stores/authStore'
import { StatCard } from '@/components/ui/StatCard'
import { StatCardSkeleton } from '@/components/ui/Skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, statusBadge } from '@/components/ui/Badge'

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed']

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

  const woByStatus = Object.entries(data.work_orders.by_status || {}).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
  }))

  const woByPriority = Object.entries(data.work_orders.by_priority || {}).map(([name, value]) => ({
    name,
    value,
  }))

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
          value={`${data.preventive_maintenance.compliance_rate}%`}
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
              <p className="text-sm text-gray-500">Completed this month</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {data.work_orders.completed_this_month}
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
              <CardTitle>Work Orders by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={woByStatus}>
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
              <CardTitle>Work Orders by Priority</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={woByPriority}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name ?? ''} ${(((percent as number | undefined) ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {woByPriority.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
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
              maintenance: data.assets.maintenance,
              offline: data.assets.offline,
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
