import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Clock, Zap } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { PMComplianceMeter } from '@/components/pm/PMComplianceMeter'
import { PMForecastTimeline } from '@/components/pm/PMForecastTimeline'
import { PMDueDateDisplay } from '@/components/pm/PMDueDateDisplay'
import { TriggerPMModal } from '@/components/pm/TriggerPMModal'
import { usePMDashboard, usePMForecast } from '@/hooks/usePreventiveMaintenance'
import type { PreventiveMaintenance } from '@/types'

// Mock data for charts when real data not available
const MOCK_TREND = Array.from({ length: 6 }, (_, i) => ({
  month: new Date(Date.now() - (5 - i) * 30 * 86400000).toLocaleString('default', { month: 'short', year: '2-digit' }),
  completed: Math.floor(Math.random() * 15) + 8,
  missed: Math.floor(Math.random() * 3),
  compliance: Math.floor(Math.random() * 20) + 78,
}))

const MOCK_BY_LOCATION = [
  { location_name: 'Building A', compliance: 95, count: 8 },
  { location_name: 'Building B', compliance: 82, count: 5 },
  { location_name: 'Warehouse', compliance: 67, count: 4 },
  { location_name: 'Roof Level', compliance: 90, count: 3 },
]

export function PMDashboardPage() {
  const [triggerTarget, setTriggerTarget] = useState<PreventiveMaintenance | null>(null)
  const { data: dashData, isLoading } = usePMDashboard(90)
  const { data: forecastData } = usePMForecast(30)

  const stats = dashData ?? {
    overall_compliance: 87,
    compliance_change: 2.3,
    due_this_week: 6,
    overdue_count: 2,
    completed_this_month: 18,
    scheduled_this_month: 21,
    avg_completion_hours: 1.8,
    avg_estimated_hours: 1.5,
    monthly_trend: MOCK_TREND,
    by_location: MOCK_BY_LOCATION,
    overdue_pms: [] as PreventiveMaintenance[],
    upcoming_week: [] as { pm: PreventiveMaintenance; due_date: string }[],
    worst_assets: [],
    recent_activity: [],
  }

  const forecastItems = forecastData?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="PM Compliance Dashboard"
        description="Last 90 days"
        actions={<Button variant="outline"><Download className="h-4 w-4 mr-1.5" />Export Report</Button>}
      />

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <PMComplianceMeter rate={stats.overall_compliance} size="md" />
              <div>
                <p className="text-xs text-gray-500">Overall Compliance</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.overall_compliance}%</p>
                <p className={`text-xs flex items-center gap-0.5 ${stats.compliance_change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.compliance_change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(stats.compliance_change)}% vs last mo
                </p>
              </div>
            </CardContent>
          </Card>

          <StatCard
            title="Due This Week"
            value={stats.due_this_week}
            subtitle={`${stats.overdue_count} overdue`}
            icon={Clock}
          />
          <StatCard
            title="Completed This Month"
            value={stats.completed_this_month}
            subtitle={`of ${stats.scheduled_this_month} scheduled`}
            icon={CheckCircle}
          />
          <StatCard
            title="Avg Completion"
            value={`${stats.avg_completion_hours}h`}
            subtitle={`vs ${stats.avg_estimated_hours}h est.`}
            icon={Clock}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Monthly Compliance Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" stackId="a" />
                <Bar dataKey="missed" name="Missed" fill="#ef4444" stackId="a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Compliance by Location</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.by_location} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="location_name" tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Compliance']} />
                <Bar dataKey="compliance" radius={[0, 4, 4, 0]}>
                  {stats.by_location.map((entry, i) => (
                    <Cell key={i} fill={entry.compliance >= 90 ? '#22c55e' : entry.compliance >= 70 ? '#eab308' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Overdue + Upcoming */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />Overdue PM Schedules
            </h3>
            {stats.overdue_pms.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-green-600 dark:text-green-400">✅ No overdue PM schedules!</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-1 text-left">PM Name</th>
                    <th className="pb-1 text-left">Asset</th>
                    <th className="pb-1 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.overdue_pms.map((pm) => (
                    <tr key={pm.id} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="py-2 font-medium">{pm.name ?? pm.title}</td>
                      <td className="py-2 text-gray-500">{pm.asset?.name ?? '—'}</td>
                      <td className="py-2 text-right">
                        <Button size="sm" onClick={() => setTriggerTarget(pm)}>
                          <Zap className="h-3.5 w-3.5 mr-1" />Trigger
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />Upcoming This Week
            </h3>
            {stats.upcoming_week.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No PMs due this week.</p>
            ) : (
              <ul className="space-y-2">
                {stats.upcoming_week.map(({ pm, due_date }, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <Link to={`/preventive-maintenance/${pm.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-brand-600">{pm.name ?? pm.title}</Link>
                      <p className="text-xs text-gray-500">{pm.asset?.name ?? '—'}</p>
                    </div>
                    <PMDueDateDisplay dueDate={due_date} showIcon={false} className="text-xs" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Forecast timeline */}
      <Card>
        <CardContent className="p-4">
          <PMForecastTimeline items={forecastItems} />
        </CardContent>
      </Card>

      {/* Recent activity */}
      {stats.recent_activity.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent PM Activity</h3>
            <ul className="space-y-2">
              {stats.recent_activity.slice(0, 10).map((evt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span>{evt.type === 'completed' ? '✅' : evt.type === 'skipped' ? '⏭' : evt.type === 'missed' ? '❌' : '📋'}</span>
                  <span className="flex-1 text-gray-700 dark:text-gray-300">{evt.pm_name}{evt.wo_number ? ` auto-generated ${evt.wo_number}` : ''}</span>
                  <span className="text-xs text-gray-400">{new Date(evt.occurred_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {triggerTarget && <TriggerPMModal open pm={triggerTarget} onClose={() => setTriggerTarget(null)} />}
    </div>
  )
}
