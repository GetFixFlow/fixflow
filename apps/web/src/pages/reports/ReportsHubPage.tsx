import { useNavigate } from 'react-router-dom'
import { Activity, Bookmark, Wrench, ClipboardCheck, Wifi, Users, DollarSign, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { Puzzle } from 'lucide-react'
import { usePluginReports } from '@/hooks/usePlugins'

const REPORT_SECTIONS = [
  { title: 'Work Orders', icon: Wrench, href: '/reports/work-orders', description: 'Trends, MTTR, priority breakdown, resolution heatmap, backlog aging', color: 'bg-blue-500', kpis: ['Total WOs', 'Avg MTTR', 'Completion Rate', 'Overdue %'] },
  { title: 'Asset Health', icon: Activity, href: '/reports/assets', description: 'Fleet health score, cost analysis, status by location, maintenance history', color: 'bg-green-500', kpis: ['Health Score', 'Operational %', 'Down Assets', 'Total Spend'] },
  { title: 'Downtime', icon: Timer, href: '/reports/downtime', description: 'Availability, failures, mean time between failures and to restore, for each asset', color: 'bg-red-500', kpis: ['Availability', 'Downtime', 'MTBF', 'MTTR'] },
  { title: 'PM Compliance', icon: ClipboardCheck, href: '/reports/pm-compliance', description: 'Compliance trends, upcoming forecast, missed PMs, frequency analysis', color: 'bg-purple-500', kpis: ['Compliance Rate', 'Scheduled', 'Completed', 'Missed'] },
  { title: 'IoT Analytics', icon: Wifi, href: '/reports/iot', description: 'Alert trends, sensor comparisons, rule effectiveness, auto-resolve rate', color: 'bg-amber-500', kpis: ['Open Alerts', 'Critical Alerts', 'Auto-Resolved', 'Active Rules'] },
  { title: 'Technician Performance', icon: Users, href: '/reports/technicians', description: 'Scorecards, workload heatmap, comparison charts, first-time fix rate', color: 'bg-teal-500', kpis: ['Top Performer', 'Avg Resolution', 'First-Fix Rate', 'Overdue Rate'] },
  { title: 'Cost Analysis', icon: DollarSign, href: '/reports/costs', description: 'Cost trends, treemap by asset, labor vs parts split, location breakdown', color: 'bg-orange-500', kpis: ['Total Cost', 'Labor Costs', 'Parts Costs', 'Cost per WO'] },
] as const

export function ReportsHubPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data: pluginReports = [] } = usePluginReports()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Operational insights across your entire CMMS"
        actions={
          <Link to="/reports/saved" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline dark:text-brand-400">
            <Bookmark className="h-4 w-4" />Saved reports
          </Link>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORT_SECTIONS.map((section) => (
          <Card key={section.href} className="cursor-pointer hover:shadow-md transition-all hover:border-gray-300"
            onClick={() => navigate(section.href)}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className={cn('rounded-xl p-2.5', section.color)}>
                  <section.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">{section.title}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{section.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {section.kpis.map((kpi) => (
                  <span key={kpi} className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] text-gray-600 dark:text-gray-300">{kpi}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pluginReports.length > 0 && (
        <section aria-labelledby="plugin-reports-heading" className="space-y-3">
          <div>
            <h2 id="plugin-reports-heading" className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('plugins.reports.section')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('plugins.reports.section_text')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pluginReports.map((report) => (
              <Card key={`${report.plugin}/${report.key}`} className="cursor-pointer hover:shadow-md transition-all hover:border-gray-300"
                onClick={() => navigate(`/reports/plugins/${report.plugin}/${report.key}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-gray-600 p-2.5"><Puzzle className="h-5 w-5 text-white" /></div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        <Link to={`/reports/plugins/${report.plugin}/${report.key}`} onClick={(e) => e.stopPropagation()}>{report.title}</Link>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{report.description}</p>
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{report.plugin_title}{report.period ? '' : ` · ${t('plugins.reports.period_now')}`}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
