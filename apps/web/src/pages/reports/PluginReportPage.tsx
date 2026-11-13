import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { ChevronLeft, Download } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { KPICard } from '@/components/reports/KPICard'
import { pluginReportsApi, type PluginColumnKind, type PluginTable } from '@/api/plugins'
import { exportErrorMessage } from '@/hooks/useReportExport'
import { triggerDownload } from '@/services/exportService'
import { formatCell } from '@/lib/pluginFormat'
import { cn } from '@/lib/utils'

const NUMERIC: PluginColumnKind[] = ['number', 'money', 'percent']
const FIELD = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800'

const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

function ResultTable({ table, name }: { table: PluginTable; name: string }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table aria-label={t('plugins.report.table', { name })} className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800/60">
          <tr>
            {table.columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-3 py-2 font-medium text-gray-700 dark:text-gray-300', NUMERIC.includes(column.kind) ? 'text-right' : 'text-left')}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {table.rows.length === 0 && (
            <tr>
              <td colSpan={table.columns.length} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">{t('plugins.report.empty')}</td>
            </tr>
          )}
          {table.rows.map((row, index) => (
            <tr key={index}>
              {row.map((value, position) => {
                const column = table.columns[position]
                return (
                  <td key={column.key} className={cn('px-3 py-2 text-gray-800 dark:text-gray-200', NUMERIC.includes(column.kind) && 'text-right tabular-nums')}>
                    {formatCell(value, column.kind)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Any report a plugin adds: the plugin only says what the table holds, and FixFlow draws it, and offers the CSV. */
export function PluginReportPage() {
  const { t } = useTranslation()
  const { plugin = '', report = '' } = useParams()
  const [from, setFrom] = useState(() => isoDay(daysAgo(30)))
  const [to, setTo] = useState(() => isoDay(new Date()))
  const [exporting, setExporting] = useState(false)
  const range = from && to && from <= to
  const params = { from, to }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['plugin_reports', plugin, report, from, to],
    queryFn: () => pluginReportsApi.get(plugin, report, params),
    enabled: !!range,
    retry: false,
  })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const file = await pluginReportsApi.download(plugin, report, params)
      triggerDownload(file.blob, file.filename)
    } catch (e) {
      toast.error(await exportErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const failure = error as AxiosError<{ error?: { code?: string; message?: string } }> | null
  const code = failure?.response?.data?.error?.code
  const failureText =
    code === 'PLUGIN_OFF' ? t('plugins.report.off')
      : failure?.response?.status === 404 ? t('plugins.report.gone')
        : failure?.response?.data?.error?.message ?? t('plugins.report.load_failed')
  const title = data?.report.title ?? t('plugins.page.title')

  return (
    <div className="space-y-5">
      <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />{t('plugins.report.back')}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={title}
          description={data ? [data.report.description, t('plugins.report.plugin', { name: data.report.plugin_title })].filter(Boolean).join(' · ') : undefined}
        />
        {data && (
          <Button variant="outline" onClick={exportCsv} disabled={exporting}>
            <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />{exporting ? t('plugins.report.exporting') : t('plugins.report.export')}
          </Button>
        )}
      </div>

      {(!data || data.report.period) && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="plugin-report-from" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{t('plugins.report.from')}</label>
            <input id="plugin-report-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label htmlFor="plugin-report-to" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{t('plugins.report.to')}</label>
            <input id="plugin-report-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={FIELD} />
          </div>
        </div>
      )}
      {data && !data.report.period && <p className="text-sm text-gray-500 dark:text-gray-400">{t('plugins.report.period_now')}</p>}

      {isLoading && <Skeleton className="h-48" />}

      {failure && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{failureText}</p>
          {code !== 'PLUGIN_OFF' && failure.response?.status !== 404 && (
            <Button variant="outline" onClick={() => refetch()}>{t('plugins.report.try_again')}</Button>
          )}
        </div>
      )}

      {data && (
        <>
          {data.table.summary.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {data.table.summary.map((figure) => (
                <KPICard key={figure.label} title={figure.label} value={formatCell(figure.value, figure.kind)} />
              ))}
            </div>
          )}
          <ResultTable table={data.table} name={data.report.title} />
          {data.table.note && <p className="text-xs text-gray-500 dark:text-gray-400">{data.table.note}</p>}
        </>
      )}
    </div>
  )
}
