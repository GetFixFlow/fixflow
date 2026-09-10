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
import { exportToCSV } from '@/services/exportService'
import { format } from 'date-fns'
import { formatCurrency, formatPercent } from '@/utils/chartUtils'
import type { Asset } from '@/types'

export function AssetHealthReportPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const dateRange = `${format(dateFrom, 'MMM d, yyyy')} – ${format(dateTo, 'MMM d, yyyy')}`

  const { data: health, isLoading } = useQuery({
    queryKey: ['reports', 'assets_health', params],
    queryFn: () => reportsApi.assets.health().then((r) => r.data as Record<string, unknown>),
  })

  const { data: cost, isLoading: costLoading } = useQuery({
    queryKey: ['reports', 'assets_cost', params],
    queryFn: () => reportsApi.assets.costAnalysis().then((r) => r.data as Record<string, unknown>),
  })

  const h = health as Record<string, unknown> | undefined
  const c = cost as Record<string, unknown> | undefined

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="Asset Health Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="Asset Health" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown onExportCSV={() => h?.assets && exportToCSV(h.assets as object[], 'asset_health', dateFrom, dateTo)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Health Score', h ? formatPercent(h.health_score as number) : '—'],
          ['Operational', h ? formatPercent(((h.operational as number) / (h.total as number)) * 100) : '—'],
          ['Assets Down', h?.down ?? 0],
          ['Total Maintenance Cost', c ? formatCurrency(c.total_cost as number) : '—'],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartContainer title="Fleet Health Distribution" loading={isLoading}>
          <AssetHealthDonut data={(h?.status_breakdown as Parameters<typeof AssetHealthDonut>[0]['data']) ?? []} healthScore={(h?.health_score as number) ?? 0} />
        </ChartContainer>
        <ChartContainer title="Health by Location" className="lg:col-span-2" loading={isLoading}>
          <AssetHealthByLocation data={(h?.by_location as Parameters<typeof AssetHealthByLocation>[0]['data']) ?? []} />
        </ChartContainer>
      </div>

      <ChartContainer title="Top Maintenance Costs by Asset" loading={costLoading}>
        <AssetCostChart data={(c?.by_asset as Parameters<typeof AssetCostChart>[0]['data']) ?? []} avgCost={(c?.avg_cost_per_asset as number) ?? 0} />
      </ChartContainer>

      <ChartContainer title="Asset Inventory">
        <DataTable data={(h?.assets as Record<string, unknown>[]) ?? []} keyField="id"
          searchable searchFields={['name', 'asset_tag']}
          onRowClick={(row) => setSelectedAsset(row as unknown as Asset)}
          columns={[
            { key: 'name', header: 'Asset Name', sortable: true },
            { key: 'asset_tag', header: 'Tag', sortable: true },
            { key: 'health_score', header: 'Health %', sortable: true, align: 'right', render: (r) => <span className={`font-semibold ${(r.health_score as number) >= 80 ? 'text-green-600' : 'text-red-500'}`}>{r.health_score}%</span> },
            { key: 'open_work_orders', header: 'Open WOs', sortable: true, align: 'right' },
            { key: 'total_work_orders', header: 'Total WOs', sortable: true, align: 'right' },
            { key: 'sensor_alerts', header: 'IoT Alerts', sortable: true, align: 'right' },
          ]} />
      </ChartContainer>

      {selectedAsset && (
        <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-5">
          <AssetDetailReport asset={selectedAsset}
            stats={{ total_wos: 0, total_cost: 0, avg_resolution_hours: 0, pm_compliance: 0, longest_downtime_hours: 0 }}
            history={[]}
            onClose={() => setSelectedAsset(null)} />
        </div>
      )}

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
