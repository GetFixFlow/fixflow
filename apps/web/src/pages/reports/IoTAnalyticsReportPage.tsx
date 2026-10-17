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
import { AlertTrendChart } from '@/components/reports/AlertTrendChart'
import { SensorTrendComparison } from '@/components/reports/SensorTrendComparison'
import { DataTable } from '@/components/reports/DataTable'
import { useReportStore } from '@/stores/reportStore'
import { reportsApi } from '@/api/reports'
import { useReportExport } from '@/hooks/useReportExport'
import { formatPercent } from '@/utils/chartUtils'
import { formatDate } from '@/lib/localeFormat'

export function IoTAnalyticsReportPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const dateRange = `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
  const { exporting, exportReport } = useReportExport()

  const { data: a, isLoading } = useQuery({
    queryKey: ['reports', 'iot_alerts', params],
    queryFn: () => reportsApi.iot.alerts(params).then((r) => r.data),
  })

  const { data: r } = useQuery({
    queryKey: ['reports', 'iot_rule_effectiveness', params],
    queryFn: () => reportsApi.iot.ruleEffectiveness(params).then((r) => r.data),
  })

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="IoT Analytics Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="IoT Analytics" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown isExporting={exporting} onExportCSV={() => exportReport('iot/alerts', 'csv', params)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Total Alerts', a?.total_alerts ?? 0],
          ['Critical Alerts', a?.critical_count ?? 0],
          ['Resolved Rate', formatPercent(a?.resolved_rate ?? 0)],
          ['Active Rules', r?.active_count ?? 0],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <ChartContainer title="Alert Trend by Severity" loading={isLoading}>
        <AlertTrendChart data={a?.trend ?? []} />
      </ChartContainer>

      {a && a.sensor_series.length > 0 && (
        <ChartContainer title="Sensor Metric Comparison">
          <SensorTrendComparison series={a.sensor_series} />
        </ChartContainer>
      )}

      <ChartContainer title="Rule Effectiveness">
        <DataTable data={r?.rules ?? []}
          columns={[
            { key: 'rule_name', header: 'Rule Name', sortable: true },
            { key: 'trigger_count', header: 'Triggers', sortable: true, align: 'right' },
            { key: 'resolve_rate', header: 'Resolved %', sortable: true, align: 'right', render: (row) => formatPercent(row.resolve_rate) },
            { key: 'wo_created', header: 'WOs Created', sortable: true, align: 'right' },
            { key: 'avg_resolution_hours', header: 'Avg Resolve Time', sortable: true, align: 'right', render: (row) => `${row.avg_resolution_hours.toFixed(1)}h` },
          ]} />
      </ChartContainer>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
