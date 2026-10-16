import { Link } from 'react-router-dom'
import { CheckCircle, ClipboardList, Clock, Wrench, AlertTriangle, ListChecks } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, formatDateTime } from '@/lib/localeFormat'
import type { RequesterDashboardStats, TechnicianDashboardStats } from '@/types'

const greeting = (name?: string) => `Welcome back, ${name?.split(' ')[0] ?? ''}`.trim()

export function TechnicianDashboard({ data, name }: { data: TechnicianDashboardStats; name?: string }) {
  const mine = data.my_work_orders
  return (
    <div className="space-y-6">
      <PageHeader title={greeting(name)} description="Your work orders and upcoming maintenance" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Assigned to me" value={mine.assigned} subtitle="waiting to be started" icon={ClipboardList} />
        <StatCard title="In progress" value={mine.in_progress} icon={Clock} />
        <StatCard title="Overdue" value={mine.overdue} subtitle="open and past the due date" icon={AlertTriangle}
          iconClassName={mine.overdue > 0 ? 'bg-red-50 dark:bg-red-900/20' : undefined} />
        <StatCard title="Completed today" value={mine.completed_today} icon={CheckCircle} />
      </div>

      <Link to="/work-orders" className="inline-block text-sm text-brand-600 hover:underline">See my work orders →</Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Upcoming maintenance</CardTitle></CardHeader>
          <CardContent>
            {data.upcoming_pms.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing is scheduled for you</p>
            ) : (
              <ul className="space-y-3">
                {data.upcoming_pms.map((pm) => (
                  <li key={pm.id} className="flex items-center justify-between text-sm">
                    <div>
                      <Link to={`/preventive-maintenance/${pm.id}`} className="font-medium text-gray-900 hover:underline dark:text-gray-100">{pm.name}</Link>
                      <span className="ml-2 text-gray-500">{pm.asset}</span>
                    </div>
                    <span className="text-xs text-gray-400">{pm.due_date ? formatDate(pm.due_date) : 'No date'}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Your recent activity</CardTitle></CardHeader>
          <CardContent>
            {data.recent_activity.length === 0 ? (
              <p className="text-sm text-gray-500">No recent activity</p>
            ) : (
              <ul className="space-y-3">
                {data.recent_activity.map((activity, index) => (
                  <li key={index} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{activity.description}</span>
                      <span className="ml-2 text-gray-500">{activity.type.replace(/[_.]/g, ' ')}</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatDateTime(activity.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function RequesterDashboard({ data, name }: { data: RequesterDashboardStats; name?: string }) {
  const mine = data.my_requests
  return (
    <div className="space-y-6">
      <PageHeader title={greeting(name)} description="How your requests are going" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="My requests" value={mine.total} icon={ListChecks} />
        <StatCard title="Still open" value={mine.open} subtitle="not finished yet" icon={Wrench} />
        <StatCard title="Completed" value={mine.completed} icon={CheckCircle} />
      </div>
      <Link to="/work-orders" className="inline-block text-sm text-brand-600 hover:underline">See my requests →</Link>
    </div>
  )
}
