import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkOrderReportsPage } from '../WorkOrderReportsPage'

vi.mock('@/api/reports', () => ({
  reportsApi: {
    workOrders: {
      summary: () => Promise.resolve({ data: { total: 100, completed: 80, overdue_rate: 5, avg_completion_hours: 4.5, by_status: { open: 20 }, trend: [], by_priority_detail: [] } }),
      mttr: () => Promise.resolve({ data: { by_group: { asset: [], location: [], technician: [] }, overall_avg: 4.5 } }),
      backlog: () => Promise.resolve({ data: { aging: [], oldest_wos: [] } }),
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

vi.mock('@/hooks/useComparisonData', () => ({
  useComparisonData: () => ({
    prevFrom: new Date('2025-12-01'),
    prevTo: new Date('2025-12-31'),
    change: vi.fn(() => ({ label: '0%', direction: 'neutral' as const })),
  }),
}))

vi.mock('@/components/reports/KPICard', () => ({
  KPICard: ({ title }: { title: string }) => <div data-testid="kpi-card">{title}</div>,
}))

vi.mock('@/components/reports/ChartContainer', () => ({
  ChartContainer: ({ title, children }: { title: string; children: React.ReactNode }) => <div>{title}{children}</div>,
}))

vi.mock('@/components/reports/ExportDropdown', () => ({
  ExportDropdown: () => <div>Export</div>,
}))

vi.mock('@/components/reports/PrintHeader', () => ({
  PrintHeader: () => null,
}))

vi.mock('@/components/reports/ReportFiltersSidebar', () => ({
  ReportFiltersSidebar: () => null,
}))

vi.mock('@/components/reports/WOTrendChart', () => ({
  WOTrendChart: () => <div>WOTrendChart</div>,
}))

vi.mock('@/components/reports/WOByPriorityChart', () => ({
  WOByPriorityChart: () => <div>WOByPriorityChart</div>,
}))

vi.mock('@/components/reports/WOStatusDonutChart', () => ({
  WOStatusDonutChart: () => <div>WOStatusDonutChart</div>,
}))

vi.mock('@/components/reports/MTTRChart', () => ({
  MTTRChart: () => <div>MTTRChart</div>,
}))

vi.mock('@/components/reports/BacklogAgingChart', () => ({
  BacklogAgingChart: () => <div>BacklogAgingChart</div>,
}))

vi.mock('@/components/reports/ResolutionHeatmap', () => ({
  ResolutionHeatmap: () => <div>ResolutionHeatmap</div>,
}))

vi.mock('@/services/exportService', () => ({
  exportToCSV: vi.fn(),
}))

vi.mock('@/utils/chartUtils', () => ({
  formatHours: (v: number) => `${v} hrs`,
  formatPercent: (v: number) => `${v}%`,
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('WorkOrderReportsPage', () => {
  it('renders KPI cards', () => {
    render(<WorkOrderReportsPage />, { wrapper: Wrapper })
    expect(screen.getByText('Total Work Orders')).toBeInTheDocument()
    expect(screen.getByText('Completion Rate')).toBeInTheDocument()
    expect(screen.getByText('Avg Resolution Time')).toBeInTheDocument()
    expect(screen.getByText('Overdue Rate')).toBeInTheDocument()
  })

  it('shows chart sections', () => {
    render(<WorkOrderReportsPage />, { wrapper: Wrapper })
    expect(screen.getByText('WO Trend')).toBeInTheDocument()
    expect(screen.getByText('Status Distribution')).toBeInTheDocument()
  })
})
