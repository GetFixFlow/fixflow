import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CostAnalysisPage } from '../CostAnalysisPage'
import { useReportStore } from '@/stores/reportStore'
import { formatCurrency } from '@/utils/chartUtils'
import { fixtures, kpiValue, serveReportFixtures } from '@/test/reportFixtures'

// Charts need a real layout to draw; the cards and the table are the real ones, fed what the server really sends.
vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))

describe('CostAnalysisPage with the server\'s real responses', () => {
  beforeEach(() => {
    useReportStore.getState().resetFilters()
    serveReportFixtures()
  })

  it('shows the totals and the assets that cost most', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><CostAnalysisPage /></MemoryRouter></QueryClientProvider>)
    const { total_cost, labor_cost, parts_cost, avg_cost_per_wo } = fixtures.costSummary
    expect(total_cost).toBeGreaterThan(0)
    await waitFor(async () => expect(await kpiValue(screen, 'Total Cost')).toBe(formatCurrency(total_cost)))
    expect(await kpiValue(screen, 'Labor Costs')).toBe(formatCurrency(labor_cost))
    expect(await kpiValue(screen, 'Parts Costs')).toBe(formatCurrency(parts_cost))
    expect(await kpiValue(screen, 'Cost per WO')).toBe(formatCurrency(avg_cost_per_wo))
    const top = fixtures.costByAsset.assets[0]
    const row = (await screen.findByText(top.asset_name)).closest('tr')!
    expect(row).toHaveTextContent(formatCurrency(top.total_cost))
  })
})
