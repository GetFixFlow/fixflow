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
import { CostTrendChart } from '@/components/reports/CostTrendChart'
import { CostTreemap } from '@/components/reports/CostTreemap'
import { DataTable } from '@/components/reports/DataTable'
import { useReportStore } from '@/stores/reportStore'
import { reportsApi } from '@/api/reports'
import { exportToCSV } from '@/services/exportService'
import { format } from 'date-fns'
import { formatCurrency } from '@/utils/chartUtils'

export function CostAnalysisPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const dateRange = `${format(dateFrom, 'MMM d, yyyy')} – ${format(dateTo, 'MMM d, yyyy')}`

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reports', 'costs_summary', params],
    queryFn: () => reportsApi.costs.summary(params).then((r) => r.data as Record<string, unknown>),
  })

  const { data: byAsset, isLoading: assetLoading } = useQuery({
    queryKey: ['reports', 'costs_by_asset', params],
    queryFn: () => reportsApi.costs.byAsset(params).then((r) => r.data as Record<string, unknown>),
  })

  const s = summary as Record<string, unknown> | undefined
  const a = byAsset as Record<string, unknown> | undefined

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="Cost Analysis Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="Cost Analysis" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown onExportCSV={() => a?.assets && exportToCSV(a.assets as object[], 'cost_by_asset', dateFrom, dateTo)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Total Cost', s ? formatCurrency(s.total_cost as number) : '—'],
          ['Labor Costs', s ? formatCurrency(s.labor_cost as number) : '—'],
          ['Parts Costs', s ? formatCurrency(s.parts_cost as number) : '—'],
          ['Cost per WO', s ? formatCurrency(s.avg_cost_per_wo as number) : '—'],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <ChartContainer title="Cost Trend" loading={isLoading}>
        <CostTrendChart data={(s?.trend as Parameters<typeof CostTrendChart>[0]['data']) ?? []} />
      </ChartContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="Cost by Asset (Treemap)" loading={assetLoading}>
          <CostTreemap data={(a?.treemap as Parameters<typeof CostTreemap>[0]['data']) ?? []} />
        </ChartContainer>
        <ChartContainer title="Top Assets by Cost" loading={assetLoading}>
          <DataTable data={(a?.assets as Record<string, unknown>[]) ?? []} compact
            columns={[
              { key: 'asset_name', header: 'Asset', sortable: true },
              { key: 'labor_cost', header: 'Labor', align: 'right', render: (r) => formatCurrency(r.labor_cost as number) },
              { key: 'parts_cost', header: 'Parts', align: 'right', render: (r) => formatCurrency(r.parts_cost as number) },
              { key: 'total_cost', header: 'Total', align: 'right', sortable: true, render: (r) => <strong>{formatCurrency(r.total_cost as number)}</strong> },
              { key: 'wo_count', header: 'WOs', align: 'right', sortable: true },
            ]} />
        </ChartContainer>
      </div>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
