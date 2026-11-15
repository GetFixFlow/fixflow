import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useSitesReport } from '@/hooks/useSites'
import { useReportStore } from '@/stores/reportStore'
import { formatDate, formatMoney } from '@/lib/localeFormat'
import { formatHours, formatPercent } from '@/utils/chartUtils'
import type { SiteRow } from '@/api/sites'

const CELL = 'px-3 py-2 text-right tabular-nums'

function Line({ row, name, strong = false }: { row: Omit<SiteRow, 'id' | 'name' | 'people' | 'availability'> & Partial<Pick<SiteRow, 'people' | 'availability'>>; name: string; strong?: boolean }) {
  return (
    <tr className={strong ? 'border-t-2 border-gray-300 font-semibold dark:border-gray-600' : 'border-t border-gray-100 dark:border-gray-700'}>
      <th scope="row" className="px-3 py-2 text-left font-medium text-gray-900 dark:text-gray-100">{name}</th>
      <td className={CELL}>{row.assets}</td>
      <td className={CELL}>{row.open_work_orders}</td>
      <td className={CELL}>{row.overdue_work_orders}</td>
      <td className={CELL}>{row.completed_work_orders}</td>
      <td className={CELL}>{formatMoney(row.total_cost)}</td>
      <td className={CELL}>{row.availability === undefined ? '—' : formatPercent(row.availability)}</td>
      <td className={CELL}>{formatHours(row.downtime_hours)}</td>
      <td className={CELL}>{row.failures}</td>
      <td className={CELL}>{row.people ?? '—'}</td>
    </tr>
  )
}

/** The sites side by side, for the period chosen in the reports' date range. */
export function SitesReportPage() {
  const { t } = useTranslation()
  const { getParams, dateFrom, dateTo } = useReportStore()
  const { from, to } = getParams() as { from: string; to: string }
  const { data, isLoading, isError } = useSitesReport({ from, to })
  const range = `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
  const columns = ['site', 'assets', 'open', 'overdue', 'finished', 'cost', 'availability', 'downtime', 'failures', 'people']

  return (
    <div className="space-y-5">
      <PageHeader title={t('sites.report.title')} description={`${t('sites.report.description')} · ${range}`} />
      {isLoading && <Skeleton className="h-48 w-full" />}
      {isError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('sites.report.load_failed')}</p>}
      {data && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {data.sites.length === 0 && <p className="p-4 text-sm text-gray-600 dark:text-gray-400">{t('sites.report.empty')}</p>}
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">{t('sites.report.description')}</caption>
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  {columns.map((key, index) => <th key={key} scope="col" className={`px-3 py-2 font-medium ${index === 0 ? 'text-left' : 'text-right'}`}>{t(`sites.report.${key}`)}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.sites.map((row) => <Line key={row.id} row={row} name={row.name ?? ''} />)}
                <Line row={data.shared} name={t('sites.report.shared')} />
                <Line row={data.total} name={t('sites.report.total')} strong />
              </tbody>
            </table>
            <p className="border-t border-gray-100 p-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-400">{t('sites.report.shared_note')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
