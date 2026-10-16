import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WorkOrderReportsPage } from '../WorkOrderReportsPage'
import { useReportStore } from '@/stores/reportStore'
import { fixtures, kpiValue, serveReportFixtures } from '@/test/reportFixtures'

// The page, its cards and tables are the real ones, fed what the server really sends (see reportFixtures.ts), so a
// field the page reads but the server does not send shows up here as a missing number.
vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><WorkOrderReportsPage /></MemoryRouter></QueryClientProvider>)
}

describe('WorkOrderReportsPage with the server\'s real responses', () => {
  let asked: URL[]
  beforeEach(() => {
    useReportStore.getState().resetFilters()
    asked = serveReportFixtures()
  })

  it('shows the totals the server sends in the four cards', async () => {
    const { totals } = fixtures.workOrderSummary
    expect(totals.created).toBeGreaterThan(0)
    renderPage()
    await waitFor(async () => expect(await kpiValue(screen, 'Total Work Orders')).toBe(String(totals.created)))
    expect(await kpiValue(screen, 'Completion Rate')).toBe(`${((totals.completed / totals.created) * 100).toFixed(1)}%`)
    expect(await kpiValue(screen, 'Avg Resolution Time')).toBe(`${totals.avg_resolution_hours.toFixed(1)} hrs`)
    expect(await kpiValue(screen, 'Overdue Rate')).toBe(`${totals.overdue_rate.toFixed(1)}%`)
  })

  it('lists the slowest assets from the MTTR report, with their hours', async () => {
    renderPage()
    const first = fixtures.mttr.by_group.asset[0]
    const table = (await screen.findByRole('columnheader', { name: 'Avg Hrs' })).closest('table')!
    const row = (await within(table).findByText(first.name)).closest('tr')!
    const hours = (n: number) => `${n.toFixed(1)}h`
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(
      [first.name, String(first.wo_count), hours(first.avg_hours), hours(first.min_hours), hours(first.max_hours)])
  })

  it('lists the oldest open work orders with their age from the backlog report', async () => {
    renderPage()
    const oldest = fixtures.backlog.oldest_wos[0]
    expect(await screen.findByText(oldest.work_order_number)).toBeInTheDocument()
    expect(screen.getByText(`${oldest.days_open}d`)).toBeInTheDocument()
  })

  it('asks for the backlog with the Filters but not the period, and everything else with both', async () => {
    useReportStore.getState().setFilter('location_ids', [7])
    renderPage()
    await screen.findByText(fixtures.backlog.oldest_wos[0].work_order_number)
    const backlog = asked.find((url) => url.pathname.endsWith('/backlog'))!
    expect(backlog.searchParams.getAll('location_ids[]')).toEqual(['7'])
    expect(backlog.searchParams.has('from')).toBe(false)
    const summary = asked.find((url) => url.pathname.endsWith('/summary'))!
    expect(summary.searchParams.has('from') && summary.searchParams.has('to')).toBe(true)
    expect(summary.searchParams.getAll('location_ids[]')).toEqual(['7'])
  })
})
