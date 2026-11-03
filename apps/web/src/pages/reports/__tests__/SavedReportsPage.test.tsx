import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { eligiblePeople, savedReport } from '@/test/savedReports'
import { SavedReportsPage } from '../SavedReportsPage'
import { useReportStore } from '@/stores/reportStore'
import { useAuthStore } from '@/stores/authStore'
import type { SavedReport } from '@/types/savedReports'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const weekly = savedReport({
  name: 'Plant 2 weekly', period: 'last_7_days', filters: { asset_ids: [4], priorities: ['high'] }, send_on: 1,
  recipient_ids: [2, 3], recipients: [{ id: 2, full_name: 'Mia Manager' }, { id: 3, full_name: 'Ana Silva' }],
  last_sent_at: '2026-11-02T08:05:00Z', last_sent_on: '2026-11-02',
})
const failing = savedReport({ name: 'Broken one', report: 'asset_health', title: 'Asset health', last_error: 'Failed: Olive Owner is no longer a manager.' })
const boss = savedReport({ name: 'Boss view', editable: false, report: 'pm_compliance', title: 'PM compliance' })

let calls: { method: string; url: string }[]

function serve(views: SavedReport[]) {
  calls = []
  server.use(
    http.get('/api/v1/saved_reports', () => HttpResponse.json({ saved_reports: views, eligible_recipients: eligiblePeople })),
    http.post('/api/v1/saved_reports/:id/send_now', ({ request }) => {
      calls.push({ method: 'POST', url: request.url })
      return HttpResponse.json({ sent_to: 'me@x.y' })
    }),
    http.delete('/api/v1/saved_reports/:id', ({ request }) => {
      calls.push({ method: 'DELETE', url: request.url })
      return new HttpResponse(null, { status: 204 })
    }),
  )
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/reports/saved']}>
        <Routes>
          <Route path="/reports/saved" element={<SavedReportsPage />} />
          <Route path="/reports/work-orders" element={<p>Work orders report</p>} />
          <Route path="/reports/assets" element={<p>Asset health report</p>} />
          <Route path="/reports" element={<p>Reports hub</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 2, email: 'm@x.y', full_name: 'Mia Manager', role: 'manager', organization_id: 1 } as never, token: 't', isAuthenticated: true })
  useReportStore.getState().resetFilters()
  serve([weekly, failing, boss])
})
afterEach(() => vi.restoreAllMocks())

describe('SavedReportsPage', () => {
  it('lists each with its report, period, filters, schedule and when it was last sent', async () => {
    renderPage()

    const row = (await screen.findByText('Plant 2 weekly')).closest('li')!
    expect(within(row).getByText('Work orders')).toBeInTheDocument()
    expect(row).toHaveTextContent('The last 7 days. 1 asset, 1 priority. Saved by Demo Admin.')
    expect(row).toHaveTextContent('Mondays at 7:00, to Mia Manager and Ana Silva')
    expect(row).toHaveTextContent(/Last sent/)
    expect(within(screen.getByText('Boss view').closest('li')!).getByText('Not emailed')).toBeInTheDocument()
  })

  it('shows why the last attempt failed, as an alert', async () => {
    renderPage()
    const row = (await screen.findByText('Broken one')).closest('li')!

    expect(within(row).getByRole('alert')).toHaveTextContent('Olive Owner is no longer a manager')
  })

  it('opens a saved report on its own report page with its filters and dates applied', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Open Plant 2 weekly' }))

    expect(await screen.findByText('Work orders report')).toBeInTheDocument()
    const { filters, getParams } = useReportStore.getState()
    expect(filters.asset_ids).toEqual([4])
    expect(getParams()).toHaveProperty('from')
  })

  it('opens each kind on the page of its own report', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Open Broken one' }))

    expect(await screen.findByText('Asset health report')).toBeInTheDocument()
  })

  it('emails the PDF to the person asking, for any saved report', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Email me Boss view now' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].url).toContain(`/saved_reports/${boss.id}/send_now`)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Sent to me@x.y.'))
  })

  it('shows the server\'s reason when it cannot be sent', async () => {
    server.use(http.post('/api/v1/saved_reports/:id/send_now', () =>
      HttpResponse.json({ error: { message: 'The report could not be made' } }, { status: 422 })))
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Email me Boss view now' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The report could not be made'))
  })

  it('offers edit and delete only on the ones the person may change', async () => {
    renderPage()
    await screen.findByText('Boss view')

    expect(screen.getByRole('button', { name: 'Edit Plant 2 weekly' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Plant 2 weekly' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Boss view' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Boss view' })).not.toBeInTheDocument()
  })

  it('opens the schedule for changing, filled in', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Plant 2 weekly' }))

    expect(screen.getByLabelText('Name *')).toHaveValue('Plant 2 weekly')
    expect(screen.getByLabelText('Period')).toHaveValue('last_7_days')
    expect(screen.getByLabelText('Email it as a PDF every week')).toBeChecked()
    expect(screen.getByLabelText('On')).toHaveValue('1')
    expect(await screen.findByLabelText(/Mia Manager/)).toBeChecked()
    expect(screen.getByLabelText(/Ana Silva/)).toBeChecked()
    expect(screen.getByLabelText(/Demo Admin/)).not.toBeChecked()
  })

  it('warns that deleting stops the emails, and deletes after a yes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Plant 2 weekly' }))

    expect(confirm.mock.calls[0][0]).toContain('It will no longer be emailed.')
    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: expect.stringContaining(`/saved_reports/${weekly.id}`) }]))
  })

  it('says nothing about emails when deleting one that is not emailed, and does nothing after a no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Broken one' }))

    expect(confirm.mock.calls[0][0]).not.toContain('emailed')
    expect(calls).toHaveLength(0)
  })

  it('says so when there are none', async () => {
    serve([])
    renderPage()

    expect(await screen.findByText('No saved reports yet')).toBeInTheDocument()
  })
})
