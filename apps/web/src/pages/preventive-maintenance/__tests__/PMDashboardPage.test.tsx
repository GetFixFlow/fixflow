import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { PMDashboardPage } from '../PMDashboardPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const EMPTY = {
  period_days: 90, overall_compliance: null, compliance_change: null, due_this_week: 0, overdue_count: 0,
  completed_this_month: 0, scheduled_this_month: 0, avg_completion_hours: null, avg_estimated_hours: null,
  monthly_trend: [
    { month: '2026-09', completed: 0, missed: 0, compliance: null },
    { month: '2026-10', completed: 0, missed: 0, compliance: null },
  ],
  by_location: [], overdue_pms: [], upcoming_week: [], recent_activity: [],
}

const pm = (id: number, name: string) => ({
  id, name, status: 'active', priority: 'medium', frequency_type: 'time_based', next_due_at: '2026-10-01T00:00:00Z',
  asset: { id: 1, name: 'Pump A', asset_tag: 'FF-1' }, created_at: '', updated_at: '',
})

function serve(dashboard: object | 'error') {
  server.use(
    http.get('/api/v1/preventive_maintenances/dashboard', () =>
      dashboard === 'error' ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(dashboard),
    ),
    http.get('/api/v1/reports/pm/schedule_forecast', () => HttpResponse.json({ by_week: [] })),
  )
}

describe('PMDashboardPage', () => {
  it('shows the real figures', async () => {
    serve({
      ...EMPTY, overall_compliance: 71.4, compliance_change: -3.2, due_this_week: 6, overdue_count: 2,
      completed_this_month: 9, scheduled_this_month: 14, avg_completion_hours: 2.5, avg_estimated_hours: 2,
    })
    render(<PMDashboardPage />, { wrapper })

    expect((await screen.findAllByText('71.4%')).length).toBeGreaterThan(0) // the figure and the meter
    expect(screen.getByText(/3\.2 pts vs previous 90 days/)).toBeInTheDocument()
    expect(screen.getByText('2.5h')).toBeInTheDocument()
    expect(screen.getByText('of 14 scheduled')).toBeInTheDocument()
    expect(screen.getByText('2 overdue')).toBeInTheDocument()
  })

  it('says there is no data instead of showing a number or a chart', async () => {
    serve(EMPTY)
    render(<PMDashboardPage />, { wrapper })

    expect(await screen.findByText('Nothing has come due yet')).toBeInTheDocument()
    expect(screen.getByText('No completed work yet')).toBeInTheDocument()
    expect(screen.getByText(/no maintenance has come due in the last six months/i)).toBeInTheDocument()
    expect(screen.getByText(/no maintenance has come due in this period/i)).toBeInTheDocument()
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
  })

  it('shows an error with a retry, and no numbers, when the dashboard cannot be loaded', async () => {
    serve('error')
    render(<PMDashboardPage />, { wrapper })

    expect(await screen.findByText(/could not be loaded, so no numbers are shown/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByText('Overall Compliance')).not.toBeInTheDocument()
  })

  it('retries when asked', async () => {
    serve('error')
    render(<PMDashboardPage />, { wrapper })
    await screen.findByText(/could not be loaded/i)

    serve({ ...EMPTY, overall_compliance: 100 })
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect((await screen.findAllByText('100%')).length).toBeGreaterThan(0)
  })

  it('lists overdue schedules with a way to run them now, and what is due this week', async () => {
    serve({
      ...EMPTY, overdue_count: 1, due_this_week: 1,
      overdue_pms: [pm(1, 'Monthly oil change')],
      upcoming_week: [{ pm: pm(2, 'Quarterly filter'), due_date: '2026-10-16T00:00:00Z' }],
    })
    render(<PMDashboardPage />, { wrapper })

    const overdue = (await screen.findByText('Overdue PM Schedules')).closest('div') as HTMLElement
    expect(within(overdue.parentElement as HTMLElement).getByText('Monthly oil change')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trigger/i })).toBeInTheDocument()
    expect(screen.getByText('Quarterly filter')).toBeInTheDocument()
  })

  it('links to the full compliance report', async () => {
    serve(EMPTY)
    render(<PMDashboardPage />, { wrapper })
    expect(await screen.findByRole('link', { name: /full compliance report/i })).toHaveAttribute('href', '/reports/pm-compliance')
  })
})
