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
import { format } from 'date-fns'
import { formatPercent } from '@/utils/chartUtils'

export function IoTAnalyticsReportPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const dateRange = `${format(dateFrom, 'MMM d, yyyy')} – ${format(dateTo, 'MMM d, yyyy')}`

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['reports', 'iot_alerts', params],
    queryFn: () => reportsApi.iot.alerts(params).then((r) => r.data as Record<string, unknown>),
  })

  const { data: rules } = useQuery({
    queryKey: ['reports', 'iot_rule_effectiveness', params],
    queryFn: () => reportsApi.iot.ruleEffectiveness(params).then((r) => r.data as Record<string, unknown>),
  })

  const a = alerts as Record<string, unknown> | undefined
  const r = rules as Record<string, unknown> | undefined

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="IoT Analytics Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="IoT Analytics" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Total Alerts', a?.total_alerts ?? 0],
          ['Critical Alerts', a?.critical_count ?? 0],
          ['Auto-Resolved Rate', a?.auto_resolved_rate ? formatPercent(a.auto_resolved_rate as number) : '0%'],
          ['Active Rules', r?.active_count ?? 0],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <ChartContainer title="Alert Trend by Severity" loading={isLoading}>
        <AlertTrendChart data={(a?.trend as Parameters<typeof AlertTrendChart>[0]['data']) ?? []} />
      </ChartContainer>

      {(a?.sensor_series as unknown[])?.length > 0 && (
        <ChartContainer title="Sensor Metric Comparison">
          <SensorTrendComparison series={a!.sensor_series as Parameters<typeof SensorTrendComparison>[0]['series']} />
        </ChartContainer>
      )}

      <ChartContainer title="Rule Effectiveness">
        <DataTable data={(r?.rules as Record<string, unknown>[]) ?? []}
          columns={[
            { key: 'rule_name', header: 'Rule Name', sortable: true },
            { key: 'trigger_count', header: 'Triggers', sortable: true, align: 'right' },
            { key: 'auto_resolve_rate', header: 'Auto-Resolve %', sortable: true, align: 'right', render: (row) => formatPercent(row.auto_resolve_rate as number) },
            { key: 'wo_created', header: 'WOs Created', sortable: true, align: 'right' },
            { key: 'avg_resolution_hours', header: 'Avg Resolve Time', sortable: true, align: 'right', render: (row) => `${(row.avg_resolution_hours as number).toFixed(1)}h` },
          ]} />
      </ChartContainer>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
