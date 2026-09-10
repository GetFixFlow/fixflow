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
import { TechnicianScorecard, type TechnicianStats } from '@/components/reports/TechnicianScorecard'
import { TechnicianComparisonChart } from '@/components/reports/TechnicianComparisonChart'
import { TechnicianDetailPanel } from '@/components/reports/TechnicianDetailPanel'
import { useReportStore } from '@/stores/reportStore'
import { reportsApi } from '@/api/reports'
import { format } from 'date-fns'
import { formatHours, formatPercent } from '@/utils/chartUtils'

type MetricKey = 'completed' | 'avg_hours' | 'overdue' | 'first_fix'

export function TechnicianPerformancePage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedTech, setSelectedTech] = useState<number | null>(null)
  const [metric, setMetric] = useState<MetricKey>('completed')
  const { getParams, dateFrom, dateTo } = useReportStore()
  const params = getParams()
  const dateRange = `${format(dateFrom, 'MMM d, yyyy')} – ${format(dateTo, 'MMM d, yyyy')}`

  const { data: techData, isLoading } = useQuery({
    queryKey: ['reports', 'technician_performance', params],
    queryFn: () => reportsApi.workOrders.technicianPerformance().then((r) => r.data as { technicians: TechnicianStats[] }),
  })

  const technicians = techData?.technicians ?? []
  const selected = technicians.find((_, i) => i === selectedTech) ?? null

  const teamAvgResolution = technicians.length > 0
    ? technicians.reduce((s, tech) => s + tech.avg_resolution_hours, 0) / technicians.length : 0
  const teamAvgFirstFix = technicians.length > 0
    ? technicians.reduce((s, tech) => s + tech.first_time_fix_rate, 0) / technicians.length : 0

  const comparisonData = technicians.map((tech) => ({
    name: tech.name.split(' ')[0],
    completed: tech.completed,
    avg_hours: tech.avg_resolution_hours,
    overdue: Math.round(100 - tech.on_time_rate),
    first_fix: Math.round(tech.first_time_fix_rate),
  }))

  return (
    <div className="space-y-5">
      <PrintHeader reportTitle="Technician Performance Report" dateRange={dateRange} />
      <div className="flex items-start justify-between print:hidden">
        <PageHeader title="Technician Performance" description={dateRange} />
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="h-4 w-4 mr-1.5" />Filters</Button>
          <ExportDropdown />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ['Total Technicians', technicians.length],
          ['Total WOs Completed', technicians.reduce((s, tech) => s + tech.completed, 0)],
          ['Team Avg Resolution', formatHours(teamAvgResolution)],
          ['Team First-Fix Rate', formatPercent(teamAvgFirstFix)],
        ] as [string, string | number][]).map(([title, value]) => (
          <KPICard key={title} title={title} value={value} loading={isLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {technicians.map((tech, i) => (
          <TechnicianScorecard key={tech.user_id} stats={tech} selected={selectedTech === i}
            onClick={() => setSelectedTech(selectedTech === i ? null : i)} />
        ))}
      </div>

      <ChartContainer title="Technician Comparison">
        <div className="flex gap-1 mb-3">
          {([['completed', 'Completed WOs'], ['avg_hours', 'Avg Resolution'], ['overdue', 'Overdue WOs'], ['first_fix', 'First-Fix %']] as [MetricKey, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setMetric(k)}
              className={`px-2.5 py-1 text-xs rounded ${metric === k ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <TechnicianComparisonChart data={comparisonData} metric={metric} />
      </ChartContainer>

      {selectedTech !== null && (
        <TechnicianDetailPanel stats={selected} onClose={() => setSelectedTech(null)} />
      )}

      <ReportFiltersSidebar open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  )
}
