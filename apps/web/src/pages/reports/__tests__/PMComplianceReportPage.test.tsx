import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { PMComplianceReportPage } from '../PMComplianceReportPage'
import { useReportStore } from '@/stores/reportStore'
import { fixtures, kpiValue, serveReportFixtures } from '@/test/reportFixtures'

// Real page, cards and forecast table, fed what the server really sends (see reportFixtures.ts).
vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><PMComplianceReportPage /></MemoryRouter></QueryClientProvider>)
}

describe('PMComplianceReportPage with the server\'s real responses', () => {
  let asked: URL[]
  beforeEach(() => {
    useReportStore.getState().resetFilters()
    asked = serveReportFixtures()
  })

  it('shows the rate and the counts, with skipped and missed together', async () => {
    const { summary, overall_compliance_rate: rate } = fixtures.pmCompliance
    expect(summary.completed + summary.skipped + summary.missed).toBeGreaterThan(0)
    renderPage()
    await waitFor(async () => expect(await kpiValue(screen, 'Compliance Rate')).toBe(`${rate!.toFixed(1)}%`))
    expect(await kpiValue(screen, 'Scheduled')).toBe(String(summary.scheduled))
    expect(await kpiValue(screen, 'Completed')).toBe(String(summary.completed))
    expect(await kpiValue(screen, 'Skipped or Missed')).toBe(String(summary.skipped + summary.missed))
  })

  it('shows "—", not 0% or 100%, when nothing has come due', async () => {
    server.use(http.get('/api/v1/reports/pm/compliance', () => HttpResponse.json({
      ...fixtures.pmCompliance, overall_compliance_rate: null,
      summary: { scheduled: 2, completed: 0, skipped: 0, missed: 0 },
    })))
    renderPage()
    await waitFor(async () => expect(await kpiValue(screen, 'Compliance Rate')).toBe('—'))
  })

  it('lists the upcoming schedules with their asset, how often they repeat and when they are due', async () => {
    renderPage()
    const first = fixtures.pmForecast.by_week[0].pms[0]
    const row = (await screen.findByText(first.name)).closest('tr')!
    expect(row).toHaveTextContent(first.asset)
    expect(row).toHaveTextContent(`Every ${first.frequency_value} ${first.frequency_unit}`)
    expect(row).not.toHaveTextContent('—')
  })

  it('asks for the compliance report and the forecast with the Filters, the report also with the period', async () => {
    useReportStore.getState().setFilter('location_ids', [3])
    renderPage()
    await screen.findByText(fixtures.pmForecast.by_week[0].pms[0].name)
    for (const path of ['/pm/compliance', '/pm/schedule_forecast']) {
      const url = asked.find((candidate) => candidate.pathname.endsWith(path))!
      expect(url.searchParams.getAll('location_ids[]'), path).toEqual(['3'])
    }
    expect(asked.find((url) => url.pathname.endsWith('/pm/compliance'))!.searchParams.has('from')).toBe(true)
  })
})
