import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { GettingStarted } from '../GettingStarted'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const counts = { Location: 0, Asset: 0, Part: 0, PreventiveMaintenance: 0, WorkOrder: 0 }
const steps = (done: Record<string, boolean> = {}) => [
  { key: 'assets', title: 'Add your equipment', description: 'Add an asset, or import a spreadsheet of them.', done: !!done.assets, path: '/assets/new' },
  { key: 'work_order', title: 'Create a work order', description: 'Log a job.', done: !!done.work_order, path: '/work-orders/new' },
  { key: 'team', title: 'Invite your team', description: 'Technicians and managers.', done: !!done.team, path: '/settings/users' },
]
const guide = (extra: object = {}) => ({ steps: steps(), all_done: false, dismissed: false, sample_loaded: false, ...extra })

const serve = (g: object = guide(), sample: object = { loaded: false, counts }) =>
  server.use(
    http.get('/api/v1/getting_started', () => HttpResponse.json(g)),
    http.get('/api/v1/sample_data', () => HttpResponse.json(sample)),
  )

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><GettingStarted /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('GettingStarted', () => {
  it('lists the three first things, each with where to do it', async () => {
    serve()
    renderCard()

    expect(await screen.findByText('Add your equipment')).toBeInTheDocument()
    expect(screen.getByText('Create a work order')).toBeInTheDocument()
    expect(screen.getByText('Invite your team')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Go' })).toHaveLength(3)
  })

  it('ticks off what has been done, and stops offering to do it', async () => {
    serve(guide({ steps: steps({ assets: true }) }))
    renderCard()

    await screen.findByText('Create a work order')
    expect(screen.getAllByLabelText('Done')).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Go' })).toHaveLength(2)
  })

  it('goes away once all three are done', async () => {
    serve(guide({ steps: steps({ assets: true, work_order: true, team: true }), all_done: true }))
    renderCard()

    await waitFor(() => expect(screen.queryByText('Getting started')).not.toBeInTheDocument())
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Add your equipment')).not.toBeInTheDocument()
  })

  it('can be put away, and stays away', async () => {
    serve()
    server.use(http.post('/api/v1/getting_started/dismiss', () => HttpResponse.json(guide({ dismissed: true }))))
    renderCard()

    await userEvent.click(await screen.findByRole('button', { name: 'Put this away' }))

    await waitFor(() => expect(screen.queryByText('Getting started')).not.toBeInTheDocument())
  })

  it('does not show when it was put away before', async () => {
    serve(guide({ dismissed: true }))
    renderCard()

    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument()
  })

  it('offers a spreadsheet import, and adding sample data', async () => {
    serve()
    renderCard()

    expect(await screen.findByRole('link', { name: /import from a spreadsheet/i })).toHaveAttribute('href', '/import')
    expect(screen.getByRole('button', { name: /add sample data/i })).toBeInTheDocument()
  })

  it('adds the sample data when asked, and says so', async () => {
    serve()
    let loaded = false
    server.use(http.post('/api/v1/sample_data', () => { loaded = true; return HttpResponse.json({ loaded: true, counts: { ...counts, Asset: 5 } }, { status: 201 }) }))
    renderCard()

    await userEvent.click(await screen.findByRole('button', { name: /add sample data/i }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Sample data added.'))
    expect(loaded).toBe(true)
  })

  it('says when what is shown is sample data, and removes it on request', async () => {
    serve(guide({ sample_loaded: true }), { loaded: true, counts: { ...counts, Asset: 5 } })
    let removed = false
    server.use(http.delete('/api/v1/sample_data', () => {
      removed = true
      return HttpResponse.json({ loaded: false, counts, report: { removed: { Asset: 5 }, kept: [] } })
    }))
    renderCard()

    expect(await screen.findByRole('status')).toHaveTextContent('sample data')
    expect(screen.queryByRole('button', { name: /add sample data/i })).not.toBeInTheDocument() // already there
    await userEvent.click(screen.getByRole('button', { name: 'Remove sample data' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Sample data removed.'))
    expect(removed).toBe(true)
  })

  it('does not remove anything when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    serve(guide(), { loaded: true, counts: { ...counts, Asset: 5 } })
    let removed = false
    server.use(http.delete('/api/v1/sample_data', () => { removed = true; return HttpResponse.json({}) }))
    renderCard()

    await userEvent.click(await screen.findByRole('button', { name: 'Remove sample data' }))

    expect(removed).toBe(false)
  })

  it('tells the person when some sample items were kept because they built on them', async () => {
    serve(guide(), { loaded: true, counts: { ...counts, Asset: 5 } })
    server.use(http.delete('/api/v1/sample_data', () => HttpResponse.json({
      loaded: false, counts, report: { removed: { Asset: 4 }, kept: [{ type: 'Asset', name: 'Sample: Pump 01', reason: 'work orders you created use it' }] },
    })))
    renderCard()

    await userEvent.click(await screen.findByRole('button', { name: 'Remove sample data' }))

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('1 item was kept')))
  })

  it("shows the server's reason when the sample data cannot be added", async () => {
    serve()
    server.use(http.post('/api/v1/sample_data', () => HttpResponse.json({ error: { message: 'Sample data is already loaded.' } }, { status: 422 })))
    renderCard()

    await userEvent.click(await screen.findByRole('button', { name: /add sample data/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Sample data is already loaded.'))
  })
})
