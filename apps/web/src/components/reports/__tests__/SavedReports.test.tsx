import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { eligiblePeople, savedReport } from '@/test/savedReports'
import { SavedReportsMenu } from '../SavedReportsMenu'
import { useReportStore } from '@/stores/reportStore'
import { useAuthStore } from '@/stores/authStore'
import type { SavedReport } from '@/types/savedReports'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mine = savedReport({ name: 'Plant 2 weekly', period: 'last_7_days', filters: { asset_ids: [4], priorities: ['high'] } })
const theirs = savedReport({ name: 'Boss view', editable: false, filters: { location_ids: [1] } })

let sent: { method: string; url: string; body: Record<string, unknown> }[]

function serve(views: SavedReport[]) {
  sent = []
  server.use(
    http.get('/api/v1/saved_reports', () => HttpResponse.json({ saved_reports: views, eligible_recipients: eligiblePeople })),
    http.post('/api/v1/saved_reports', async ({ request }) => {
      sent.push({ method: 'POST', url: request.url, body: (await request.json()) as never })
      return HttpResponse.json({ data: savedReport({ name: 'Created' }) }, { status: 201 })
    }),
    http.patch('/api/v1/saved_reports/:id', async ({ request }) => {
      sent.push({ method: 'PATCH', url: request.url, body: (await request.json()) as never })
      return HttpResponse.json({ data: mine })
    }),
  )
}

function renderMenu() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><SavedReportsMenu report="work_orders" /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: { id: 2, email: 'm@x.y', full_name: 'Mia Manager', role: 'manager', organization_id: 1 } as never, token: 't', isAuthenticated: true })
  useReportStore.getState().resetFilters()
  serve([mine, theirs])
})

describe('SavedReportsMenu', () => {
  it('offers the saved views of this report, and applies the one chosen to the report filters', async () => {
    renderMenu()
    await userEvent.selectOptions(await screen.findByLabelText('Saved views'), 'Plant 2 weekly')

    const { filters } = useReportStore.getState()
    expect(filters.asset_ids).toEqual([4])
    expect(filters.priorities).toEqual(['high'])
    expect(filters.location_ids).toEqual([])
  })

  it('asks the server only for the views of its own report', async () => {
    let asked = ''
    server.use(http.get('/api/v1/saved_reports', ({ request }) => {
      asked = new URL(request.url).searchParams.get('report') ?? ''
      return HttpResponse.json({ saved_reports: [], eligible_recipients: [] })
    }))
    renderMenu()
    await screen.findByRole('button', { name: /save view/i })

    await waitFor(() => expect(asked).toBe('work_orders'))
  })

  it('shows no list of views when there are none, but still lets one be saved', async () => {
    serve([])
    renderMenu()

    expect(await screen.findByRole('button', { name: /save view/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Saved views')).not.toBeInTheDocument()
  })

  it('saves the filters now chosen under a name', async () => {
    useReportStore.getState().setFilter('priorities', ['critical'])
    useReportStore.getState().setFilter('location_ids', [3, 4])
    renderMenu()
    await userEvent.click(await screen.findByRole('button', { name: /save view/i }))
    expect(screen.getByText('Filters: 2 places, 1 priority')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Name *'), '  Criticals ')
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].body.saved_report).toEqual({
      name: 'Criticals', report: 'work_orders', period: 'last_30_days', filters: { location_ids: [3, 4], priorities: ['critical'] },
      send_on: null, recipient_ids: [],
    })
  })

  it('brings a view up to date with the filters now chosen, only when the person may change it', async () => {
    renderMenu()
    const select = await screen.findByLabelText('Saved views')

    await userEvent.selectOptions(select, 'Boss view')
    expect(screen.queryByRole('button', { name: 'Update filters' })).not.toBeInTheDocument()

    await userEvent.selectOptions(select, 'Plant 2 weekly')
    useReportStore.getState().setFilter('sources', ['pm'])
    await userEvent.click(screen.getByRole('button', { name: 'Update filters' }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].url).toContain(`/saved_reports/${mine.id}`)
    expect(sent[0].body.saved_report).toEqual({ filters: { asset_ids: [4], priorities: ['high'], sources: ['pm'] } })
  })

  it('links to where they are all kept', async () => {
    renderMenu()

    expect(await screen.findByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/reports/saved')
  })
})

describe('SaveReportModal schedule', () => {
  async function openModal() {
    renderMenu()
    await userEvent.click(await screen.findByRole('button', { name: /save view/i }))
    await userEvent.type(screen.getByLabelText('Name *'), 'Weekly')
  }

  it('wants a name', async () => {
    renderMenu()
    await userEvent.click(await screen.findByRole('button', { name: /save view/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Give it a name.')
    expect(sent).toHaveLength(0)
  })

  it('emails weekly to the people chosen, starting with the person saving it', async () => {
    await openModal()
    await userEvent.click(screen.getByLabelText('Email it as a PDF every week'))
    await userEvent.selectOptions(screen.getByLabelText('On'), 'Friday')
    expect(await screen.findByLabelText(/Mia Manager/)).toBeChecked()
    await userEvent.click(screen.getByLabelText(/Ana Silva/))
    await userEvent.selectOptions(screen.getByLabelText('Period'), 'last_month')
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].body.saved_report).toMatchObject({ name: 'Weekly', period: 'last_month', send_on: 5, recipient_ids: [2, 3] })
  })

  it('wants somebody to email it to', async () => {
    await openModal()
    await userEvent.click(screen.getByLabelText('Email it as a PDF every week'))
    await userEvent.click(await screen.findByLabelText(/Mia Manager/))
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one person')
    expect(sent).toHaveLength(0)
  })

  it('sends no schedule when the box is not ticked, even if people were chosen then unticked', async () => {
    await openModal()
    await userEvent.click(screen.getByLabelText('Email it as a PDF every week'))
    await userEvent.click(screen.getByLabelText('Email it as a PDF every week'))
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].body.saved_report).toMatchObject({ send_on: null, recipient_ids: [] })
  })

  it('shows the server\'s reason when it refuses', async () => {
    const { toast } = await import('sonner')
    server.use(http.post('/api/v1/saved_reports', () =>
      HttpResponse.json({ error: { message: 'Name has already been taken' } }, { status: 422 })))
    await openModal()
    await userEvent.click(screen.getByRole('button', { name: 'Save view' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Name has already been taken'))
  })

  it('lists only the people the server says can receive it', async () => {
    await openModal()
    await userEvent.click(screen.getByLabelText('Email it as a PDF every week'))
    const group = await screen.findByRole('group', { name: 'To' })

    expect(within(group).getAllByRole('checkbox').map((box) => box.parentElement?.textContent)).toEqual([
      'Demo Admin admin', 'Mia Manager manager', 'Ana Silva manager',
    ])
  })
})
