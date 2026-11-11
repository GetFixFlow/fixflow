import { t as translate } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CheckCircle, ClipboardList, Clock, Wrench, AlertTriangle, ListChecks } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatDate, formatDateTime } from '@/lib/localeFormat'
import type { RequesterDashboardStats, TechnicianDashboardStats } from '@/types'

const greeting = (name?: string) => translate('dashboard.welcome', { name: name?.split(' ')[0] ?? '' }).trim()

export function TechnicianDashboard({ data, name }: { data: TechnicianDashboardStats; name?: string }) {
  const { t } = useTranslation()
  const mine = data.my_work_orders
  return (
    <div className="space-y-6">
      <PageHeader title={greeting(name)} description={t('dashboard.tech.description')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t('dashboard.tech.assigned')} value={mine.assigned} subtitle={t('dashboard.tech.waiting')} icon={ClipboardList} />
        <StatCard title={t('dashboard.in_progress')} value={mine.in_progress} icon={Clock} />
        <StatCard title={t('dashboard.tech.overdue')} value={mine.overdue} subtitle={t('dashboard.tech.past_due')} icon={AlertTriangle}
          iconClassName={mine.overdue > 0 ? 'bg-red-50 dark:bg-red-900/20' : undefined} />
        <StatCard title={t('dashboard.tech.completed_today')} value={mine.completed_today} icon={CheckCircle} />
      </div>

      <Link to="/work-orders" className="inline-block text-sm text-brand-600 dark:text-brand-400 hover:underline">{t('dashboard.tech.see')}</Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('dashboard.tech.upcoming')}</CardTitle></CardHeader>
          <CardContent>
            {data.upcoming_pms.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.tech.nothing')}</p>
            ) : (
              <ul className="space-y-3">
                {data.upcoming_pms.map((pm) => (
                  <li key={pm.id} className="flex items-center justify-between text-sm">
                    <div>
                      <Link to={`/preventive-maintenance/${pm.id}`} className="font-medium text-gray-900 hover:underline dark:text-gray-100">{pm.name}</Link>
                      <span className="ml-2 text-gray-500 dark:text-gray-400">{pm.asset}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{pm.due_date ? formatDate(pm.due_date) : t('dashboard.tech.no_date')}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('dashboard.tech.recent')}</CardTitle></CardHeader>
          <CardContent>
            {data.recent_activity.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.no_activity')}</p>
            ) : (
              <ul className="space-y-3">
                {data.recent_activity.map((activity, index) => (
                  <li key={index} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{activity.description}</span>
                      <span className="ml-2 text-gray-500 dark:text-gray-400">{activity.type.replace(/[_.]/g, ' ')}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(activity.timestamp)}</span>
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
  const { t } = useTranslation()
  const mine = data.my_requests
  return (
    <div className="space-y-6">
      <PageHeader title={greeting(name)} description={t('dashboard.req.description')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title={t('dashboard.req.mine')} value={mine.total} icon={ListChecks} />
        <StatCard title={t('dashboard.req.open')} value={mine.open} subtitle={t('dashboard.req.not_finished')} icon={Wrench} />
        <StatCard title={t('common.status.completed')} value={mine.completed} icon={CheckCircle} />
      </div>
      <Link to="/work-orders" className="inline-block text-sm text-brand-600 dark:text-brand-400 hover:underline">{t('dashboard.req.see')}</Link>
    </div>
  )
}
