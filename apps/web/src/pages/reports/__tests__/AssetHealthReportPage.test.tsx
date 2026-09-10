import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssetHealthReportPage } from '../AssetHealthReportPage'

vi.mock('@/api/reports', () => ({
  reportsApi: {
    assets: {
      health: () => Promise.resolve({ data: { health_score: 87, total: 50, operational: 42, degraded: 5, down: 3, status_breakdown: [], by_location: [], assets: [] } }),
      costAnalysis: () => Promise.resolve({ data: { total_cost: 25000, by_asset: [], avg_cost_per_asset: 500, treemap: [] } }),
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
vi.mock('@/components/reports/AssetHealthDonut', () => ({ AssetHealthDonut: () => <div>AssetHealthDonut</div> }))
vi.mock('@/components/reports/AssetHealthByLocation', () => ({ AssetHealthByLocation: () => <div>AssetHealthByLocation</div> }))
vi.mock('@/components/reports/AssetCostChart', () => ({ AssetCostChart: () => <div>AssetCostChart</div> }))
vi.mock('@/components/reports/AssetDetailReport', () => ({ AssetDetailReport: () => <div>AssetDetailReport</div> }))
vi.mock('@/components/reports/DataTable', () => ({ DataTable: () => <div>DataTable</div> }))

vi.mock('@/services/exportService', () => ({ exportToCSV: vi.fn() }))

vi.mock('@/utils/chartUtils', () => ({
  formatCurrency: (v: number) => `$${v}`,
  formatPercent: (v: number) => `${v}%`,
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

describe('AssetHealthReportPage', () => {
  it('renders KPI cards', () => {
    render(<AssetHealthReportPage />, { wrapper: Wrapper })
    expect(screen.getByText('Health Score')).toBeInTheDocument()
    expect(screen.getByText('Assets Down')).toBeInTheDocument()
  })
})
