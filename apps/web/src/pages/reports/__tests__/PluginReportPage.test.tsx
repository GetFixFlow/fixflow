import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { triggerDownload } from '@/services/exportService'
import { formatCell } from '@/lib/pluginFormat'
import { PluginReportPage } from '../PluginReportPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/services/exportService', () => ({ triggerDownload: vi.fn(), copyShareLink: vi.fn() }))

const info = (over: Record<string, unknown> = {}) => ({
  plugin: 'overdue_work', plugin_title: 'Overdue work', key: 'finished_late', title: 'Finished late',
  description: 'Work finished in the period.', period: true, ...over,
})

const table = (over: Record<string, unknown> = {}) => ({
  columns: [
    { key: 'person', label: 'Person', kind: 'text' },
    { key: 'finished', label: 'Finished', kind: 'number' },
    { key: 'late_share', label: 'Late share', kind: 'percent' },
    { key: 'oldest', label: 'Oldest due date', kind: 'date' },
  ],
  rows: [['Ana Perera', 12, 50, '2026-11-03'], ['Ben Silva', 3, 12.5, null]],
  summary: [{ label: 'Finished', kind: 'number', value: 15 }],
  note: 'Open means not completed.',
  ...over,
})

function renderPage(path = '/reports/plugins/overdue_work/finished_late') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/reports/plugins/:plugin/:report" element={<PluginReportPage />} />
          <Route path="/reports" element={<p>Reports hub</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** The server's side: the report it makes, and a record of the periods it was asked for. */
function serve(result: { report?: object; table?: object } = {}) {
  const asked: Record<string, string>[] = []
  server.use(
    http.get('/api/v1/plugin_reports/:plugin/:report', ({ request, params }) => {
      asked.push(Object.fromEntries(new URL(request.url).searchParams))
      if (String(params.report).endsWith('.csv')) return new HttpResponse('csv')
      return HttpResponse.json({ report: info(result.report as Record<string, unknown>), from: null, to: null, table: result.table ?? table() })
    }),
  )
  return asked
}

beforeEach(() => vi.clearAllMocks())

describe('formatCell', () => {
  it('shows each kind of value the way the company shows it, and an empty one as a dash', () => {
    expect(formatCell(1234, 'number')).toBe('1,234')
    expect(formatCell(1234.5, 'number')).toBe('1,234.50')
    expect(formatCell(12.5, 'percent')).toBe('12.5%')
    expect(formatCell(50, 'percent')).toBe('50%')
    expect(formatCell(12.5, 'money')).toBe('$12.50')
    expect(formatCell('2026-11-03', 'date')).toBe('Nov 3, 2026')
    expect(formatCell('Pump 3', 'text')).toBe('Pump 3')
    expect(formatCell(null, 'number')).toBe('—')
    expect(formatCell('', 'text')).toBe('—')
  })
})

describe('PluginReportPage', () => {
  it('draws the table the plugin made, with its summary and note', async () => {
    serve()
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Finished late' })).toBeInTheDocument()
    expect(screen.getByText(/Work finished in the period\. · From the plugin Overdue work/)).toBeInTheDocument()
    const grid = screen.getByRole('table', { name: 'Finished late report' })
    expect(within(grid).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Person', 'Finished', 'Late share', 'Oldest due date'])
    const rows = within(grid).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => c.textContent))
    expect(rows).toEqual([['Ana Perera', '12', '50%', 'Nov 3, 2026'], ['Ben Silva', '3', '12.5%', '—']])
    expect(screen.getByText('Open means not completed.')).toBeInTheDocument()
    expect(screen.getAllByText('Finished').length).toBeGreaterThan(1) // the summary figure and the column
  })

  it('says there is nothing to show for an empty table', async () => {
    serve({ table: table({ rows: [], summary: [], note: null }) })
    renderPage()

    expect(await screen.findByText('Nothing to show for this period.')).toBeInTheDocument()
  })

  it('asks for the period shown, and again when it is changed', async () => {
    const asked = serve()
    renderPage()
    await screen.findByRole('table')
    expect(asked[0]).toMatchObject({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })

    const from = screen.getByLabelText('From')
    await userEvent.clear(from)
    await userEvent.type(from, '2026-10-01')

    await waitFor(() => expect(asked[asked.length - 1]?.from).toBe('2026-10-01'))
  })

  it('shows no date picker for a report that is as of now', async () => {
    serve({ report: { period: false, key: 'overdue_now', title: 'Overdue now' } })
    renderPage('/reports/plugins/overdue_work/overdue_now')

    expect(await screen.findByRole('heading', { level: 1, name: 'Overdue now' })).toBeInTheDocument()
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
    expect(screen.getByText('As of now')).toBeInTheDocument()
  })

  it('downloads the same report as CSV', async () => {
    const asked = serve()
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Export as CSV' }))

    await waitFor(() => expect(triggerDownload).toHaveBeenCalledTimes(1))
    expect(vi.mocked(triggerDownload).mock.calls[0][1]).toBe('overdue_work_finished_late.csv')
    expect(asked.length).toBeGreaterThan(1)
  })

  describe('when the report cannot be made', () => {
    it('says the plugin is switched off, without offering to try again', async () => {
      server.use(http.get('/api/v1/plugin_reports/:plugin/:report', () =>
        HttpResponse.json({ success: false, error: { code: 'PLUGIN_OFF', message: 'This plugin is switched off.' } }, { status: 404 })))
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent('An administrator can switch it on under Settings, Plugins.')
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Export as CSV' })).not.toBeInTheDocument() // nothing to export
    })

    it('says the report is no longer installed', async () => {
      server.use(http.get('/api/v1/plugin_reports/:plugin/:report', () =>
        HttpResponse.json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Report not found' } }, { status: 404 })))
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent('This report is no longer installed.')
    })

    it('shows the plugin author the sentence the server gave, and offers to try again', async () => {
      server.use(http.get('/api/v1/plugin_reports/:plugin/:report', () =>
        HttpResponse.json({ success: false, error: { code: 'PLUGIN_REPORT_FAILED', message: 'The report has no columns.' } }, { status: 422 })))
      renderPage()

      expect(await screen.findByRole('alert')).toHaveTextContent('The report has no columns.')
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  it('goes back to the reports', async () => {
    serve()
    renderPage()

    await userEvent.click(await screen.findByRole('link', { name: 'Reports' }))

    expect(await screen.findByText('Reports hub')).toBeInTheDocument()
  })
})
