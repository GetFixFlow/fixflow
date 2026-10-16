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
import { WOTrendChart } from '@/components/reports/WOTrendChart'
import { WOByPriorityChart } from '@/components/reports/WOByPriorityChart'
import { WOStatusDonutChart } from '@/components/reports/WOStatusDonutChart'
import { MTTRChart } from '@/components/reports/MTTRChart'
import { BacklogAgingChart } from '@/components/reports/BacklogAgingChart'
import { ResolutionHeatmap } from '@/components/reports/ResolutionHeatmap'
import { useReportStore } from '@/stores/reportStore'
import { reportsApi } from '@/api/reports'
import { useReportExport } from '@/hooks/useReportExport'
import { formatHours, formatPercent } from '@/utils/chartUtils'
import { withoutPeriod } from '@/utils/reportParams'
import { formatDate } from '@/lib/localeFormat'

export function WorkOrderReportsPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const { exporting, exportReport } = useReportExport()

  const params = getParams()
  const dateRange = `${formatDate(dateFrom)} – ${formatDate(dateTo)}`

  const { data: s, isLoading } = useQuery({
    queryKey: ['reports', 'wo_summary', params],
    queryFn: () => reportsApi.workOrders.summary(params).then((r) => r.data),
  })

  const { data: mttr, isLoading: mttrLoading } = useQuery({
    queryKey: ['reports', 'wo_mttr', params],
    queryFn: () => reportsApi.workOrders.mttr(params).then((r) => r.data),
  })

  const backlogParams = withoutPeriod(params)
  const { data: backlog } = useQuery({
    queryKey: ['reports', 'wo_backlog', backlogParams],
    queryFn: () => reportsApi.workOrders.backlog(backlogParams).then((r) => r.data),
  })

  const totals = s?.totals
  const kpis = [
    { title: 'Total Work Orders', value: totals?.created ?? 0 },
    { title: 'Completion Rate', value: totals?.created ? formatPercent((totals.completed / totals.created) * 100) : '—' },
    { title: 'Avg Resolution Time', value: totals?.avg_resolution_hours ? formatHours(totals.avg_resolution_hours) : '—' },
    { title: 'Overdue Rate', value: formatPercent(totals?.overdue_rate ?? 0) },
  ]

  return (
    <div className="space-y-5 print:space-y-4">
      <PrintHeader reportTitle="Work Order Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="Work Orders" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
          </Button>
          <ExportDropdown
            isExporting={exporting}
            onExportCSV={() => exportReport('work_orders/summary', 'csv', params)}
            onExportPDF={() => exportReport('work_orders/summary', 'pdf', params)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KPICard key={k.title} title={k.title} value={k.value} loading={isLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartContainer title="WO Trend" className="lg:col-span-2" loading={isLoading}>
          <WOTrendChart data={s?.trend ?? []} />
        </ChartContainer>
        <ChartContainer title="Status Distribution" loading={isLoading}>
          <WOStatusDonutChart data={Object.entries(s?.by_status ?? {}).map(([status, count]) => ({ status, count }))} />
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="By Priority" loading={isLoading}>
          <WOByPriorityChart data={s?.by_priority_detail ?? []} />
        </ChartContainer>
        <ChartContainer title="MTTR Analysis" loading={mttrLoading}>
          <MTTRChart data={mttr?.by_group ?? { asset: [], location: [], technician: [] }} overall_avg={mttr?.overall_avg ?? 0} />
        </ChartContainer>
      </div>

      <ChartContainer title="Backlog Aging">
        <BacklogAgingChart data={backlog?.aging ?? []} oldestWOs={backlog?.oldest_wos ?? []} />
      </ChartContainer>

      <ChartContainer title="Resolution Heatmap (Last 13 Weeks)" subtitle="Daily completed work orders">
        <ResolutionHeatmap data={s?.completion_heatmap ?? []} />
      </ChartContainer>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
