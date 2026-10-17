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
import { useReportExport } from '@/hooks/useReportExport'
import { formatPercent } from '@/utils/chartUtils'
import { formatDate } from '@/lib/localeFormat'
import { formatFrequency } from '@/components/pm/PMFrequencyBadge'
import type { PmFrequencyType, PmFrequencyUnit } from '@/types'

export function PMComplianceReportPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const { exporting, exportReport } = useReportExport()
  const dateRange = `${formatDate(dateFrom)} – ${formatDate(dateTo)}`

  const { data: compliance, isLoading } = useQuery({
    queryKey: ['reports', 'pm_compliance', params],
    queryFn: () => reportsApi.pm.compliance(params).then((r) => r.data),
  })

  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['reports', 'pm_forecast', params],
    queryFn: () => reportsApi.pm.forecast(params).then((r) => r.data),
  })

  const c = compliance
  const trend = (c?.by_month ?? []).map((m) => ({
    period: m.month,
    scheduled: m.scheduled,
    completed: m.completed,
    missed: m.skipped + m.missed,
    compliance_rate: m.compliance_rate,
  }))

  const today = new Date()
  const forecastRows = (forecast?.by_week ?? []).flatMap((week) =>
    week.pms.map((pm) => {
      const dueDate = new Date(pm.due_date)
      const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / 86400000)
      return {
        id: pm.pm_id,
        pm_title: pm.name,
        asset_name: pm.asset,
        frequency: formatFrequency(pm.frequency_type as PmFrequencyType, pm.frequency_value ?? undefined, (pm.frequency_unit ?? undefined) as PmFrequencyUnit | undefined),
        next_due_date: pm.due_date,
        days_until_due: daysUntilDue,
        assignee_name: pm.assigned_to ?? undefined,
        estimated_hours: pm.estimated_hours,
        status: (daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 7 ? 'due_soon' : 'on_track') as
          | 'overdue'
          | 'due_soon'
          | 'on_track',
      }
    }),
  )

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="PM Compliance Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="PM Compliance" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown
            isExporting={exporting}
            onExportCSV={() => exportReport('pm/compliance', 'csv', params)}
            onExportPDF={() => exportReport('pm/compliance', 'pdf', params)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Compliance Rate', c && c.overall_compliance_rate !== null ? formatPercent(c.overall_compliance_rate) : '—'],
          ['Scheduled', c?.summary.scheduled ?? 0],
          ['Completed', c?.summary.completed ?? 0],
          ['Skipped or Missed', c ? c.summary.skipped + c.summary.missed : 0],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <ChartContainer title="PM Compliance Trend" loading={isLoading}>
        <PMComplianceTrendChart data={trend} />
      </ChartContainer>

      <ChartContainer title="Upcoming PM Forecast" subtitle={`Next ${forecast?.forecast_days ?? 30} days`} loading={forecastLoading}>
        <PMForecastTable rows={forecastRows} />
      </ChartContainer>

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
