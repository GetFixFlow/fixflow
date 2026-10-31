import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { KPICard } from '@/components/reports/KPICard'
import { ChartContainer } from '@/components/reports/ChartContainer'
import { ExportDropdown } from '@/components/reports/ExportDropdown'
import { PrintHeader } from '@/components/reports/PrintHeader'
import { ReportFiltersSidebar } from '@/components/reports/ReportFiltersSidebar'
import { DowntimeChart } from '@/components/reports/DowntimeChart'
import { DataTable } from '@/components/reports/DataTable'
import { useReportStore } from '@/stores/reportStore'
import { reportsApi } from '@/api/reports'
import { useReportExport } from '@/hooks/useReportExport'
import { formatHours, formatPercent } from '@/utils/chartUtils'
import { formatDate } from '@/lib/localeFormat'

const hours = (value: number | null) => (value === null ? '—' : formatHours(value))

export function DowntimeReportPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const { exporting, exportReport } = useReportExport()
  const dateRange = `${formatDate(dateFrom)} – ${formatDate(dateTo)}`

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'assets_downtime', params],
    queryFn: () => reportsApi.assets.downtime(params).then((r) => r.data),
  })
  const summary = data?.summary

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="Downtime Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="Downtime" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown isExporting={exporting} onExportCSV={() => exportReport('assets/downtime', 'csv', params)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          ['Availability', summary ? formatPercent(summary.availability) : '—', summary ? `${summary.assets} assets` : undefined],
          ['Downtime', summary ? hours(summary.downtime_hours) : '—', summary?.down_now ? `${summary.down_now} down now` : undefined],
          ['Failures', summary?.failures ?? 0, 'stops in the period'],
          ['MTBF', summary ? hours(summary.mtbf_hours) : '—', 'mean time between failures'],
          ['MTTR', summary ? hours(summary.mttr_hours) : '—', 'mean time to restore'],
        ] as [string, string | number, string | undefined][]).map(([title, value, subtitle]) => (
          <KPICard key={title} title={title} value={value} subtitle={subtitle} loading={isLoading} />
        ))}
      </div>

      <ChartContainer title="Most Downtime" subtitle="Hours down, the ten longest" loading={isLoading}>
        <DowntimeChart data={data?.assets ?? []} />
      </ChartContainer>

      <ChartContainer title="Availability by Asset" subtitle="Least available first" loading={isLoading}>
        <DataTable data={data?.assets ?? []} keyField="id"
          searchable searchFields={['name', 'asset_tag']}
          columns={[
            { key: 'name', header: 'Asset', sortable: true, render: (r) => (
              <span>{r.name}{r.down_now && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">Down now</span>}</span>
            ) },
            { key: 'asset_tag', header: 'Tag', sortable: true },
            { key: 'location', header: 'Location', sortable: true, render: (r) => r.location ?? '—' },
            { key: 'availability', header: 'Availability', sortable: true, align: 'right', render: (r) => formatPercent(r.availability) },
            { key: 'downtime_hours', header: 'Downtime', sortable: true, align: 'right', render: (r) => hours(r.downtime_hours) },
            { key: 'failures', header: 'Failures', sortable: true, align: 'right' },
            { key: 'mtbf_hours', header: 'MTBF', sortable: true, align: 'right', render: (r) => hours(r.mtbf_hours) },
            { key: 'mttr_hours', header: 'MTTR', sortable: true, align: 'right', render: (r) => hours(r.mttr_hours) },
          ]} />
      </ChartContainer>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
