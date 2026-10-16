import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useReportStore } from '@/stores/reportStore'
import { WorkOrderReportsPage } from '../WorkOrderReportsPage'
import { AssetHealthReportPage } from '../AssetHealthReportPage'
import { PMComplianceReportPage } from '../PMComplianceReportPage'
import { CostAnalysisPage } from '../CostAnalysisPage'
import { TechnicianPerformancePage } from '../TechnicianPerformancePage'

const saved = vi.hoisted(() => ({ files: [] as Array<{ blob: Blob; filename: string }> }))
vi.mock('@/services/exportService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/exportService')>()),
  triggerDownload: (blob: Blob, filename: string) => saved.files.push({ blob, filename }),
}))

// Empty reports in the shape each page reads, so the pages render as they do on a company with no activity yet.
const REPORT_BODIES: Record<string, unknown> = {
  'work_orders/summary': { total: 0, completed: 0, overdue_rate: 0, avg_completion_hours: 0, by_status: {}, trend: [], by_priority_detail: [] },
  'assets/health': { total: 1, operational: 1, down: 0, health_score: 100, by_location: [], status_breakdown: [], assets: [] },
  'pm/compliance': {
    overall_compliance_rate: 0, period: { from: '', to: '' }, summary: { scheduled: 0, completed: 0, skipped: 0, overdue: 0 },
    by_month: [], by_location: [], worst_performing_assets: [],
  },
  'pm/schedule_forecast': { forecast_days: 30, total_upcoming: 0, estimated_hours: 0, by_week: [] },
}

/** Answers each report request with an empty report, and file requests with a small file, noting every request made. */
function serveReports() {
  const requests: Array<{ path: string; search: URLSearchParams }> = []
  server.use(
    http.get('/api/v1/reports/*', ({ request }) => {
      const url = new URL(request.url)
      const path = url.pathname.replace('/api/v1/reports/', '')
      requests.push({ path, search: url.searchParams })
      if (path.endsWith('.csv') || path.endsWith('.pdf')) {
        const csv = path.endsWith('.csv')
        return new HttpResponse(csv ? 'a,b\n1,2\n' : '%PDF-1.4', {
          headers: {
            'Content-Type': csv ? 'text/csv' : 'application/pdf',
            'Content-Disposition': `attachment; filename="${path.replace('/', '_')}"`,
          },
        })
      }
      return HttpResponse.json(REPORT_BODIES[path] ?? {})
    }),
    http.get('/api/v1/dashboard', () => HttpResponse.json({})),
  )
  return requests
}

function renderPage(page: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  )
}

async function choose(user: ReturnType<typeof userEvent.setup>, item: RegExp) {
  await user.click(screen.getByRole('button', { name: /^export/i }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

function readText(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsText(blob)
  })
}

const exportRequests = (all: ReturnType<typeof serveReports>) => all.filter((r) => /\.(csv|pdf)$/.test(r.path))

describe('Export on the report pages', () => {
  beforeEach(() => {
    saved.files.length = 0
    useReportStore.getState().resetFilters?.()
  })

  it.each([
    ['work orders', <WorkOrderReportsPage key="a" />, 'work_orders/summary'],
    ['asset health', <AssetHealthReportPage key="b" />, 'assets/health'],
    ['PM compliance', <PMComplianceReportPage key="c" />, 'pm/compliance'],
  ])('%s: offers CSV and PDF, each a real file from the server', async (_name, page, path) => {
    const user = userEvent.setup()
    const requests = serveReports()
    renderPage(page)

    await choose(user, /export as csv/i)
    await waitFor(() => expect(saved.files).toHaveLength(1))
    await choose(user, /export as pdf/i)
    await waitFor(() => expect(saved.files).toHaveLength(2))

    expect(exportRequests(requests).map((r) => r.path)).toEqual([`${path}.csv`, `${path}.pdf`])
    expect(saved.files[0].filename).toBe(`${path.replace('/', '_')}.csv`)
    expect(await readText(saved.files[0].blob)).toBe('a,b\n1,2\n')
  })

  it.each([
    ['cost analysis', <CostAnalysisPage key="d" />, 'costs/by_asset'],
    ['technician performance', <TechnicianPerformancePage key="e" />, 'work_orders/technician_performance'],
  ])('%s: offers CSV only, because it has no PDF', async (_name, page, path) => {
    const user = userEvent.setup()
    const requests = serveReports()
    renderPage(page)

    await user.click(screen.getByRole('button', { name: /^export/i }))
    expect(await screen.findByRole('menuitem', { name: /export as csv/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /export as pdf/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: /export as csv/i }))

    await waitFor(() => expect(saved.files).toHaveLength(1))
    expect(exportRequests(requests).map((r) => r.path)).toEqual([`${path}.csv`])
  })

  it('asks for the file with the same dates and filters as the screen asked for its data', async () => {
    const user = userEvent.setup()
    const requests = serveReports()
    useReportStore.getState().setFilter?.('priorities', ['high'])
    renderPage(<WorkOrderReportsPage />)

    await choose(user, /export as csv/i)
    await waitFor(() => expect(saved.files).toHaveLength(1))

    const screenRequest = requests.find((r) => r.path === 'work_orders/summary')!
    const fileRequest = exportRequests(requests)[0]
    expect(fileRequest.search.toString()).toBe(screenRequest.search.toString())
    expect(fileRequest.search.getAll('priorities[]')).toEqual(['high'])
    expect(fileRequest.search.get('from')).toBeTruthy()
  })
})
