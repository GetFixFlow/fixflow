import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TechnicianPerformancePage } from '../TechnicianPerformancePage'
import { useReportStore } from '@/stores/reportStore'
import { fixtures, kpiValue, serveReportFixtures } from '@/test/reportFixtures'

vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><TechnicianPerformancePage /></MemoryRouter></QueryClientProvider>)
}

describe('TechnicianPerformancePage with the server\'s real responses', () => {
  let asked: URL[]
  beforeEach(() => {
    useReportStore.getState().resetFilters()
    asked = serveReportFixtures()
  })

  it('shows a card for each technician and the team totals', async () => {
    const { technicians } = fixtures.technicians
    expect(technicians.length).toBeGreaterThan(1)
    renderPage()
    for (const tech of technicians) expect(await screen.findByText(tech.name)).toBeInTheDocument()
    expect(await kpiValue(screen, 'Total Technicians')).toBe(String(technicians.length))
    expect(await kpiValue(screen, 'Total WOs Completed')).toBe(String(technicians.reduce((sum, tech) => sum + tech.completed, 0)))
  })

  it('sends the period and the Filters panel\'s choices, so the figures match the chosen period', async () => {
    useReportStore.getState().setFilter('priorities', ['high'])
    renderPage()
    await waitFor(() => expect(asked.length).toBeGreaterThan(0))
    const url = asked.find((candidate) => candidate.pathname.endsWith('/technician_performance'))!
    expect(url.searchParams.has('from') && url.searchParams.has('to')).toBe(true)
    expect(url.searchParams.getAll('priorities[]')).toEqual(['high'])
  })
})
