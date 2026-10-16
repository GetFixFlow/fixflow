import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssetHealthReportPage } from '../AssetHealthReportPage'
import { useReportStore } from '@/stores/reportStore'
import { formatCurrency } from '@/utils/chartUtils'
import { fixtures, kpiValue, serveReportFixtures } from '@/test/reportFixtures'

// Real page, cards and table, fed what the server really sends (see reportFixtures.ts).
vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><AssetHealthReportPage /></MemoryRouter></QueryClientProvider>)
}

describe('AssetHealthReportPage with the server\'s real responses', () => {
  let asked: URL[]
  beforeEach(() => {
    useReportStore.getState().resetFilters()
    asked = serveReportFixtures()
  })

  it('shows the health score, the operational share, the assets down and the cost', async () => {
    const health = fixtures.assetHealth
    expect(health.by_status.down).toBeGreaterThan(0)
    renderPage()
    await waitFor(async () => expect(await kpiValue(screen, 'Health Score')).toBe(`${health.health_score.toFixed(1)}%`))
    expect(await kpiValue(screen, 'Operational')).toBe(`${((health.by_status.operational / health.total) * 100).toFixed(1)}%`)
    expect(await kpiValue(screen, 'Assets Down')).toBe(String(health.by_status.down))
    expect(fixtures.costSummary.total_cost).toBeGreaterThan(0)
    expect(await kpiValue(screen, 'Total Maintenance Cost')).toBe(formatCurrency(fixtures.costSummary.total_cost))
  })

  it('lists every asset in the inventory with its status, place and counts', async () => {
    renderPage()
    const first = fixtures.assetHealth.assets[0]
    const row = (await screen.findByText(first.name)).closest('tr')!
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      first.name, first.asset_tag, first.status, first.location ?? '—',
      String(first.open_work_orders), String(first.total_work_orders), String(first.sensor_alerts),
    ])
    for (const asset of fixtures.assetHealth.assets) expect(screen.getByText(asset.name)).toBeInTheDocument()
  })

  it('asks for the health report and the costs with the period and the Filters', async () => {
    useReportStore.getState().setFilter('asset_ids', [4, 5])
    renderPage()
    await screen.findByText(fixtures.assetHealth.assets[0].name)
    await waitFor(() => expect(asked.some((url) => url.pathname.endsWith('/costs/by_asset'))).toBe(true))
    for (const path of ['/assets/health', '/costs/summary', '/costs/by_asset']) {
      const url = asked.find((candidate) => candidate.pathname.endsWith(path))!
      expect(url.searchParams.getAll('asset_ids[]'), path).toEqual(['4', '5'])
    }
    expect(asked.find((url) => url.pathname.endsWith('/costs/summary'))!.searchParams.has('from')).toBe(true)
  })

  it('opens the asset\'s figures from its history when a row is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    const { summary } = fixtures.assetHistory
    await user.click((await screen.findByText(fixtures.assetHealth.assets[0].name)).closest('tr')!)
    const panel = (await screen.findByText('Total Cost')).closest('dl')!
    const shown = Object.fromEntries(Array.from(panel.querySelectorAll('div')).map((cell) => [cell.querySelector('dt')!.textContent, cell.querySelector('dd')!.textContent]))
    expect(shown['Total WOs']).toBe(String(summary.total_work_orders))
    expect(shown['Total Cost']).toBe(formatCurrency(summary.total_maintenance_cost))
    expect(shown['PM Compliance']).toBe(`${summary.pm_compliance_rate}%`)
    expect(asked.some((url) => /\/assets\/\d+\/history$/.test(url.pathname))).toBe(true)
  })
})
