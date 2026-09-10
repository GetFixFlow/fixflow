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
import { useComparisonData } from '@/hooks/useComparisonData'
import { reportsApi } from '@/api/reports'
import { exportToCSV } from '@/services/exportService'
import { format } from 'date-fns'
import { formatHours, formatPercent } from '@/utils/chartUtils'

export function WorkOrderReportsPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const { change } = useComparisonData()

  const params = getParams()
  const dateRange = `${format(dateFrom, 'MMM d, yyyy')} – ${format(dateTo, 'MMM d, yyyy')}`

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reports', 'wo_summary', params],
    queryFn: () => reportsApi.workOrders.summary(params).then((r) => r.data as Record<string, unknown>),
  })

  const { data: mttr, isLoading: mttrLoading } = useQuery({
    queryKey: ['reports', 'wo_mttr', params],
    queryFn: () => reportsApi.workOrders.mttr(params).then((r) => r.data as Record<string, unknown>),
  })

  const { data: backlog } = useQuery({
    queryKey: ['reports', 'wo_backlog'],
    queryFn: () => reportsApi.workOrders.backlog().then((r) => r.data as Record<string, unknown>),
  })

  const s = summary as Record<string, number & Record<string, unknown>> | undefined

  const kpis = [
    { title: 'Total Work Orders', value: s?.total ?? 0, metric: 'total' },
    { title: 'Completion Rate', value: s?.total ? formatPercent(((s.completed as number) / (s.total as number)) * 100) : '—', metric: 'completion' },
    { title: 'Avg Resolution Time', value: s?.avg_completion_hours ? formatHours(s.avg_completion_hours as number) : '—', metric: 'avg_resolution_hours' },
    { title: 'Overdue Rate', value: s?.overdue_rate ? formatPercent(s.overdue_rate as number) : '0%', metric: 'overdue_rate' },
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
          <ExportDropdown onExportCSV={() => s && exportToCSV([s], 'work_order_report', dateFrom, dateTo)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KPICard key={k.title} title={k.title} value={k.value} loading={isLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartContainer title="WO Trend" className="lg:col-span-2" loading={isLoading}>
          <WOTrendChart data={(s?.trend as Parameters<typeof WOTrendChart>[0]['data']) ?? []} />
        </ChartContainer>
        <ChartContainer title="Status Distribution" loading={isLoading}>
          <WOStatusDonutChart data={Object.entries((s?.by_status as Record<string, number>) ?? {}).map(([status, count]) => ({ status, count }))} />
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="By Priority" loading={isLoading}>
          <WOByPriorityChart data={(s?.by_priority_detail as Parameters<typeof WOByPriorityChart>[0]['data']) ?? []} />
        </ChartContainer>
        <ChartContainer title="MTTR Analysis" loading={mttrLoading}>
          <MTTRChart data={(mttr?.by_group as Parameters<typeof MTTRChart>[0]['data']) ?? { asset: [], location: [], technician: [] }} overall_avg={(mttr?.overall_avg as number) ?? 0} />
        </ChartContainer>
      </div>

      <ChartContainer title="Backlog Aging">
        <BacklogAgingChart data={(backlog?.aging as Parameters<typeof BacklogAgingChart>[0]['data']) ?? []} oldestWOs={(backlog?.oldest_wos as Parameters<typeof BacklogAgingChart>[0]['oldestWOs']) ?? []} />
      </ChartContainer>

      <ChartContainer title="Resolution Heatmap (Last 13 Weeks)" subtitle="Daily completed work orders">
        <ResolutionHeatmap data={(s?.completion_heatmap as Parameters<typeof ResolutionHeatmap>[0]['data']) ?? []} />
      </ChartContainer>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
