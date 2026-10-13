import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parse } from 'date-fns'
import { FileText, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Clock, Zap } from 'lucide-react'
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

export function PMDashboardPage() {
  const [triggerTarget, setTriggerTarget] = useState<PreventiveMaintenance | null>(null)
  const { data: stats, isLoading, isError, refetch } = usePMDashboard(90)
  const { data: forecastData } = usePMForecast(30)

  const header = (days: number) => (
    <PageHeader
      title="PM Compliance Dashboard"
      description={`Last ${days} days`}
      actions={
        <Link to="/reports/pm-compliance">
          <Button variant="outline"><FileText className="h-4 w-4 mr-1.5" />Full compliance report</Button>
        </Link>
      }
    />
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header(90)}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </div>
    )
  }

  if (isError || !stats) {
    return (
      <div className="space-y-6">
        {header(90)}
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              The dashboard could not be loaded, so no numbers are shown.
            </p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const forecastItems = forecastData?.items ?? []
  const trend = stats.monthly_trend.map((m) => ({
    ...m,
    label: format(parse(m.month, 'yyyy-MM', new Date()), "MMM ''yy"),
  }))
  const trendHasData = trend.some((m) => m.completed + m.missed > 0)
  const change = stats.compliance_change

  return (
    <div className="space-y-6">
      {header(stats.period_days)}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            {stats.overall_compliance != null && <PMComplianceMeter rate={stats.overall_compliance} size="md" />}
            <div>
              <p className="text-xs text-gray-500">Overall Compliance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.overall_compliance == null ? '—' : `${stats.overall_compliance}%`}
              </p>
              {stats.overall_compliance == null ? (
                <p className="text-xs text-gray-400">Nothing has come due yet</p>
              ) : change != null ? (
                <p className={`text-xs flex items-center gap-0.5 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(change)} pts vs previous {stats.period_days} days
                </p>
              ) : null}
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
          value={stats.avg_completion_hours == null ? '—' : `${stats.avg_completion_hours}h`}
          subtitle={
            stats.avg_completion_hours == null
              ? 'No completed work yet'
              : stats.avg_estimated_hours == null ? undefined : `vs ${stats.avg_estimated_hours}h est.`
          }
          icon={Clock}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Monthly Completed vs Missed</h3>
            {trendHasData ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="completed" name="Completed" fill="#22c55e" stackId="a" />
                  <Bar dataKey="missed" name="Missed or skipped" fill="#ef4444" stackId="a" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-gray-400">No maintenance has come due in the last six months.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Compliance by Location</h3>
            {stats.by_location.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.by_location} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="location_name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Compliance']} />
                  <Bar dataKey="compliance" radius={[0, 4, 4, 0]}>
                    {stats.by_location.map((entry, i) => (
                      <Cell key={i} fill={(entry.compliance ?? 0) >= 90 ? '#22c55e' : (entry.compliance ?? 0) >= 70 ? '#eab308' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-gray-400">No maintenance has come due in this period.</p>
            )}
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
                      <td className="py-2 font-medium">{pm.name}</td>
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
                      <Link to={`/preventive-maintenance/${pm.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-brand-600">{pm.name}</Link>
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
