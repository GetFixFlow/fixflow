import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { serveReportFixtures } from '@/test/reportFixtures'
import { eligiblePeople } from '@/test/savedReports'
import { useReportStore } from '@/stores/reportStore'
import { WorkOrderReportsPage } from '../WorkOrderReportsPage'
import { AssetHealthReportPage } from '../AssetHealthReportPage'
import { PMComplianceReportPage } from '../PMComplianceReportPage'

vi.mock('@/components/reports/ReportFiltersSidebar', () => ({ ReportFiltersSidebar: () => null }))

// Each report page that can make a PDF offers Save view, and keeps the view under its own report.
const PAGES = [
  ['work_orders', WorkOrderReportsPage],
  ['asset_health', AssetHealthReportPage],
  ['pm_compliance', PMComplianceReportPage],
] as const

describe('Save view on the report pages', () => {
  let body: { saved_report: Record<string, unknown> } | undefined

  beforeEach(() => {
    body = undefined
    useReportStore.getState().resetFilters()
    serveReportFixtures()
    server.use(
      http.get('/api/v1/saved_reports', () => HttpResponse.json({ saved_reports: [], eligible_recipients: eligiblePeople })),
      http.post('/api/v1/saved_reports', async ({ request }) => {
        body = (await request.json()) as never
        return HttpResponse.json({ data: {} }, { status: 201 })
      }),
    )
  })

  it.each(PAGES)('saves the filters now chosen as a view of %s', async (report, Page) => {
    useReportStore.getState().setFilter('priorities', ['high'])
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter><Page /></MemoryRouter>
      </QueryClientProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /save view/i }))
    await userEvent.type(screen.getByLabelText('Name *'), 'My view')
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body!.saved_report).toMatchObject({ report, name: 'My view', filters: { priorities: ['high'] } })
  })
})
