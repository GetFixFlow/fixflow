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
import { AssetHealthDonut } from '@/components/reports/AssetHealthDonut'
import { AssetHealthByLocation } from '@/components/reports/AssetHealthByLocation'
import { AssetCostChart } from '@/components/reports/AssetCostChart'
import { AssetDetailReport } from '@/components/reports/AssetDetailReport'
import { DataTable } from '@/components/reports/DataTable'
import { useReportStore } from '@/stores/reportStore'
import { reportsApi } from '@/api/reports'
import { useReportExport } from '@/hooks/useReportExport'
import { formatCurrency, formatPercent } from '@/utils/chartUtils'
import type { InventoryAsset } from '@/types/reports'
import { format, parseISO } from 'date-fns'
import { formatDate } from '@/lib/localeFormat'

export function AssetHealthReportPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<InventoryAsset | null>(null)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const { exporting, exportReport } = useReportExport()
  const dateRange = `${formatDate(dateFrom)} – ${formatDate(dateTo)}`

  const { data: h, isLoading } = useQuery({
    queryKey: ['reports', 'assets_health', params],
    queryFn: () => reportsApi.assets.health(params).then((r) => r.data),
  })

  // The same figures as the Cost Analysis page: work finished in the period, for the Filters' assets and places.
  const { data: costSummary } = useQuery({
    queryKey: ['reports', 'costs_summary', params],
    queryFn: () => reportsApi.costs.summary(params).then((r) => r.data),
  })

  const { data: costByAsset, isLoading: costLoading } = useQuery({
    queryKey: ['reports', 'costs_by_asset', params],
    queryFn: () => reportsApi.costs.byAsset(params).then((r) => r.data),
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['reports', 'asset_history', selectedAsset?.id],
    queryFn: () => reportsApi.assets.history(selectedAsset!.id).then((r) => r.data),
    enabled: selectedAsset !== null,
  })

  const averageCostPerAsset = costByAsset?.total_assets ? (costSummary?.total_cost ?? 0) / costByAsset.total_assets : 0
  const statusCounts = Object.entries(h?.by_status ?? {}).filter(([, count]) => count > 0).map(([status, count]) => ({ status, count }))

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="Asset Health Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="Asset Health" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown
            isExporting={exporting}
            onExportCSV={() => exportReport('assets/health', 'csv', params)}
            onExportPDF={() => exportReport('assets/health', 'pdf', params)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Health Score', h ? formatPercent(h.health_score) : '—'],
          ['Operational', h?.total ? formatPercent((h.by_status.operational / h.total) * 100) : '—'],
          ['Assets Down', h?.by_status.down ?? 0],
          ['Total Maintenance Cost', costSummary ? formatCurrency(costSummary.total_cost) : '—'],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartContainer title="Fleet Health Distribution" loading={isLoading}>
          <AssetHealthDonut data={statusCounts} healthScore={h?.health_score ?? 0} />
        </ChartContainer>
        <ChartContainer title="Health by Location" className="lg:col-span-2" loading={isLoading}>
          <AssetHealthByLocation data={h?.by_location ?? []} />
        </ChartContainer>
      </div>

      <ChartContainer title="Top Maintenance Costs by Asset" loading={costLoading}>
        <AssetCostChart data={costByAsset?.assets ?? []} avgCost={averageCostPerAsset} />
      </ChartContainer>

      <ChartContainer title="Asset Inventory" subtitle={h && h.total > h.assets.length ? `Showing ${h.assets.length} of ${h.total} assets` : undefined} loading={isLoading}>
        <DataTable data={h?.assets ?? []} keyField="id"
          searchable searchFields={['name', 'asset_tag']}
          onRowClick={(row) => setSelectedAsset(row)}
          columns={[
            { key: 'name', header: 'Asset Name', sortable: true },
            { key: 'asset_tag', header: 'Tag', sortable: true },
            { key: 'status', header: 'Status', sortable: true, render: (r) => <span className="capitalize">{r.status}</span> },
            { key: 'location', header: 'Location', sortable: true, render: (r) => r.location ?? '—' },
            { key: 'open_work_orders', header: 'Open WOs', sortable: true, align: 'right' },
            { key: 'total_work_orders', header: 'Total WOs', sortable: true, align: 'right' },
            { key: 'sensor_alerts', header: 'Open IoT Alerts', sortable: true, align: 'right' },
          ]} />
      </ChartContainer>

      {selectedAsset && (
        <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-5">
          {historyLoading || !history ? (
            <p className="text-sm text-gray-500">Loading {selectedAsset.name}…</p>
          ) : (
            <AssetDetailReport asset={selectedAsset}
              stats={{
                total_wos: history.summary.total_work_orders,
                total_cost: history.summary.total_maintenance_cost,
                avg_resolution_hours: history.summary.avg_resolution_hours,
                pm_compliance: history.summary.pm_compliance_rate,
              }}
              history={history.monthly.map((row) => ({ ...row, month: format(parseISO(row.month), 'MMM') }))}
              onClose={() => setSelectedAsset(null)} />
          )}
        </div>
      )}

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
