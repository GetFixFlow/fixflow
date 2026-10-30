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
import { useReportExport } from '@/hooks/useReportExport'
import { formatCurrency } from '@/utils/chartUtils'
import { formatDate } from '@/lib/localeFormat'

export function CostAnalysisPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const { exporting, exportReport } = useReportExport()
  const dateRange = `${formatDate(dateFrom)} – ${formatDate(dateTo)}`

  const { data: s, isLoading, isError } = useQuery({
    queryKey: ['reports', 'costs_summary', params],
    queryFn: () => reportsApi.costs.summary(params).then((r) => r.data),
  })

  const { data: a, isLoading: assetLoading, isError: assetError } = useQuery({
    queryKey: ['reports', 'costs_by_asset', params],
    queryFn: () => reportsApi.costs.byAsset(params).then((r) => r.data),
  })

  const { data: v, isError: vendorError } = useQuery({
    queryKey: ['reports', 'costs_by_vendor', params],
    queryFn: () => reportsApi.costs.byVendor(params).then((r) => r.data),
  })

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="Cost Analysis Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="Cost Analysis" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown isExporting={exporting} onExportCSV={() => exportReport('costs/by_asset', 'csv', params)} />
        </div>
      </div>

      {(isError || assetError || vendorError) && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          The cost figures could not be loaded, so none are shown. Try again in a moment.
        </p>
      )}
      {s && s.work_orders_count === 0 && (
        <p role="status" className="rounded-md bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          No work was finished in this period, so there are no costs to show. Costs count in the period a work order was completed, and
          labor costs need an hourly rate (Settings, Company, or a person&apos;s own rate under Users).
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          ['Total Cost', s ? formatCurrency(s.total_cost) : '—'],
          ['Labor Costs', s ? formatCurrency(s.labor_cost) : '—'],
          ['Parts Costs', s ? formatCurrency(s.parts_cost) : '—'],
          ['Vendor Costs', s ? formatCurrency(s.vendor_cost) : '—'],
          ['Cost per WO', s ? formatCurrency(s.avg_cost_per_wo) : '—'],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <ChartContainer title="Cost Trend" loading={isLoading}>
        <CostTrendChart data={s?.trend ?? []} unit={s?.group_by} />
      </ChartContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="Cost by Asset (Treemap)" loading={assetLoading}>
          <CostTreemap data={a?.treemap ?? []} />
        </ChartContainer>
        <ChartContainer title="Top Assets by Cost" loading={assetLoading}>
          <DataTable data={a?.assets ?? []} compact
            columns={[
              { key: 'asset_name', header: 'Asset', sortable: true },
              { key: 'labor_cost', header: 'Labor', align: 'right', render: (r) => formatCurrency(r.labor_cost) },
              { key: 'parts_cost', header: 'Parts', align: 'right', render: (r) => formatCurrency(r.parts_cost) },
              { key: 'vendor_cost', header: 'Vendors', align: 'right', render: (r) => formatCurrency(r.vendor_cost) },
              { key: 'total_cost', header: 'Total', align: 'right', sortable: true, render: (r) => <strong>{formatCurrency(r.total_cost)}</strong> },
              { key: 'wo_count', header: 'WOs', align: 'right', sortable: true },
            ]} />
        </ChartContainer>
      </div>

      <ChartContainer title="Costs by Vendor">
        {v?.vendors?.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No work given to a vendor was finished in this period.</p>
        ) : (
          <DataTable data={v?.vendors ?? []} compact
            columns={[
              { key: 'vendor_name', header: 'Vendor', sortable: true },
              { key: 'vendor_cost', header: 'Charged', align: 'right', sortable: true, render: (r) => <strong>{formatCurrency(r.vendor_cost)}</strong> },
              { key: 'wo_count', header: 'WOs', align: 'right', sortable: true },
            ]} />
        )}
      </ChartContainer>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
