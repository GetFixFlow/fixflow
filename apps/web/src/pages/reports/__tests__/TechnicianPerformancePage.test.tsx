import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TechnicianPerformancePage } from '../TechnicianPerformancePage'

vi.mock('@/api/reports', () => ({
  reportsApi: {
    workOrders: {
      technicianPerformance: () => Promise.resolve({
        data: { technicians: [], avg_resolution_hours: 5.2, avg_first_fix_rate: 72.3, workload_heatmap: [] }
      }),
    },
  },
}))

vi.mock('@/stores/reportStore', () => ({
  useReportStore: () => ({
    getParams: () => ({}), dateFrom: new Date('2026-01-01'), dateTo: new Date('2026-01-31'),
    toggleCompare: vi.fn(), compareMode: false, filters: { priorities: [], sources: [], location_ids: [], asset_ids: [], user_ids: [] },
    setDateRange: vi.fn(), setFilter: vi.fn(), resetFilters: vi.fn(),
  }),
}))

vi.mock('@/components/reports/KPICard', () => ({
  KPICard: ({ title }: { title: string }) => <div data-testid="kpi-card">{title}</div>,
}))

vi.mock('@/components/reports/ChartContainer', () => ({
  ChartContainer: ({ title, children }: { title: string; children: React.ReactNode }) => <div>{title}{children}</div>,
}))

vi.mock('@/components/reports/ExportDropdown', () => ({ ExportDropdown: () => <div>Export</div> }))
vi.mock('@/components/reports/PrintHeader', () => ({ PrintHeader: () => null }))
vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))
vi.mock('@/components/reports/TechnicianScorecard', () => ({ TechnicianScorecard: () => <div>TechnicianScorecard</div> }))
vi.mock('@/components/reports/TechnicianComparisonChart', () => ({ TechnicianComparisonChart: () => <div>TechnicianComparisonChart</div> }))
vi.mock('@/components/reports/WorkloadHeatmap', () => ({ WorkloadHeatmap: () => <div>WorkloadHeatmap</div> }))
vi.mock('@/components/reports/TechnicianDetailPanel', () => ({ TechnicianDetailPanel: () => null }))

vi.mock('@/utils/chartUtils', () => ({
  formatHours: (v: number) => `${v} hrs`,
  formatPercent: (v: number) => `${v}%`,
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('TechnicianPerformancePage', () => {
  it('renders performance metrics', () => {
    render(<TechnicianPerformancePage />, { wrapper: Wrapper })
    expect(screen.getByText('Total Technicians')).toBeInTheDocument()
    expect(screen.getByText('Team Avg Resolution')).toBeInTheDocument()
  })
})
