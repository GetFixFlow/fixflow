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
import { PMComplianceTrendChart } from '@/components/reports/PMComplianceTrendChart'
import { PMForecastTable } from '@/components/reports/PMForecastTable'
import { useReportStore } from '@/stores/reportStore'
import { reportsApi } from '@/api/reports'
import { format } from 'date-fns'
import { formatPercent } from '@/utils/chartUtils'

export function PMComplianceReportPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const dateRange = `${format(dateFrom, 'MMM d, yyyy')} – ${format(dateTo, 'MMM d, yyyy')}`

  const { data: compliance, isLoading } = useQuery({
    queryKey: ['reports', 'pm_compliance', params],
    queryFn: () => reportsApi.pm.compliance(params).then((r) => r.data as Record<string, unknown>),
  })

  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['reports', 'pm_forecast'],
    queryFn: () => reportsApi.pm.forecast().then((r) => r.data as Record<string, unknown>),
  })

  const c = compliance as Record<string, unknown> | undefined
  const f = forecast as Record<string, unknown> | undefined

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="PM Compliance Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="PM Compliance" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Compliance Rate', c ? formatPercent(c.compliance_rate as number) : '—'],
          ['Scheduled', c?.total_scheduled ?? 0],
          ['Completed On Time', c?.total_completed ?? 0],
          ['Missed', c?.total_missed ?? 0],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <ChartContainer title="PM Compliance Trend" loading={isLoading}>
        <PMComplianceTrendChart data={(c?.trend as Parameters<typeof PMComplianceTrendChart>[0]['data']) ?? []} target={(c?.target_compliance as number) ?? 95} />
      </ChartContainer>

      <ChartContainer title="Upcoming PM Forecast" subtitle="Next 90 days" loading={forecastLoading}>
        <PMForecastTable rows={(f?.forecast as Parameters<typeof PMForecastTable>[0]['rows']) ?? []} />
      </ChartContainer>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
