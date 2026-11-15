import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { setLanguage } from '@/i18n'
import { useAuthStore } from '@/stores/authStore'
import type { Site, SitesResponse } from '@/api/sites'
import { SitesPage } from '../SitesPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const company = { timezone: 'America/New_York', work_hours: { start: '08:00', end: '17:00' }, work_days: [1, 2, 3, 4, 5], holidays: [{ date: '2026-07-04', name: 'Independence Day' }] }

const site = (over: Partial<Site> = {}): Site => ({
  id: 1, name: 'North', settings: {}, effective: company, assets: 12, open_work_orders: 3, places: 4, people: [{ id: 5, full_name: 'Nora North', role: 'technician' }], ...over,
})

const response = (over: Partial<SitesResponse> = {}): SitesResponse => ({ enabled: true, sites: [site()], company, my_site_ids: [], ...over })

const users = [
  { id: 5, full_name: 'Nora North', role: 'technician', active: true },
  { id: 6, full_name: 'Sam South', role: 'manager', active: true },
  { id: 7, full_name: 'Ada Admin', role: 'admin', active: true },
  { id: 8, full_name: 'Gone Gary', role: 'technician', active: false },
]

function renderPage(role = 'admin') {
  useAuthStore.setState({ user: { id: 1, email: 'a@b.c', full_name: 'Ada', role, organization_id: 1 } as never, token: 't', isAuthenticated: true })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SitesPage /></QueryClientProvider>)
}

/** The server's side: what it holds, and a record of what the page sent. */
function serve(current: SitesResponse) {
  const sent: { enabled?: unknown; created?: unknown; updated?: Record<string, unknown>; people?: unknown } = {}
  server.use(
    http.get('/api/v1/sites', () => HttpResponse.json(current)),
    http.get('/api/v1/users', () => HttpResponse.json({ users, meta: {} })),
    http.put('/api/v1/sites/enabled', async ({ request }) => { sent.enabled = (await request.json() as { enabled: boolean }).enabled; return HttpResponse.json(current) }),
    http.post('/api/v1/sites', async ({ request }) => { sent.created = await request.json(); return HttpResponse.json({ data: site() }, { status: 201 }) }),
    http.patch('/api/v1/sites/:id', async ({ request }) => { sent.updated = await request.json() as Record<string, unknown>; return HttpResponse.json({ data: site() }) }),
    http.put('/api/v1/sites/:id/people', async ({ request }) => { sent.people = await request.json(); return HttpResponse.json({ data: site() }) }),
  )
  return sent
}

beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(async () => { await setLanguage('en', false) })

describe('SitesPage', () => {
  it('is for administrators only', async () => {
    renderPage('manager')

    expect(await screen.findByText(/Only administrators can manage sites/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Work as several sites')).not.toBeInTheDocument()
  })

  it('says whether sites are on, and what that means for who sees what', async () => {
    serve(response({ enabled: false }))
    renderPage()

    const toggle = await screen.findByLabelText('Work as several sites')
    expect(toggle).not.toBeChecked()
    expect(toggle).toHaveAccessibleDescription(/sees only those sites' places, assets, work orders/)
    expect(screen.getByText(/Sites are off: everyone sees everything/)).toBeInTheDocument()
  })

  it('switches sites on, after asking, and off again', async () => {
    const user = userEvent.setup()
    const sent = serve(response({ enabled: false }))
    renderPage()

    await user.click(await screen.findByLabelText('Work as several sites'))

    await waitFor(() => expect(sent.enabled).toBe(true))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('People assigned to no site keep seeing everything'))
  })

  it('does nothing when the person says no to the question', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    const sent = serve(response({ enabled: false }))
    renderPage()

    await user.click(await screen.findByLabelText('Work as several sites'))

    expect(sent.enabled).toBeUndefined()
  })

  it('lists each site with what is in it, and adds one by name', async () => {
    const user = userEvent.setup()
    const sent = serve(response())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'North' })).toBeInTheDocument()
    expect(screen.getByText('12 assets · 3 open work orders · 4 places inside')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add site' })).toBeDisabled()
    await user.type(screen.getByLabelText('Site name'), 'East')
    await user.click(screen.getByRole('button', { name: 'Add site' }))

    await waitFor(() => expect(sent.created).toEqual({ site: { name: 'East' } }))
  })

  it('says how to make a site when there are none', async () => {
    serve(response({ sites: [] }))
    renderPage()

    expect(await screen.findByText(/There are no sites yet/)).toBeInTheDocument()
  })

  describe('a site\'s calendar', () => {
    it('follows the company until a line is unticked, and says what the company has', async () => {
      serve(response())
      renderPage()

      expect(await screen.findByLabelText('Same as the company (America/New_York)')).toBeChecked()
      expect(screen.getByLabelText('Same as the company (08:00 – 17:00)')).toBeChecked()
      expect(screen.getByLabelText('1 from the company')).toBeChecked()
      expect(screen.queryByLabelText('Start')).not.toBeInTheDocument()
    })

    it('saves only what the site sets of its own, and what stays on the company is left out', async () => {
      const user = userEvent.setup()
      const sent = serve(response())
      renderPage()

      await user.click(await screen.findByLabelText('Same as the company (08:00 – 17:00)'))
      const start = screen.getByLabelText('Start')
      await user.clear(start)
      await user.type(start, '06:00')
      await user.click(screen.getByRole('button', { name: 'Save calendar' }))

      await waitFor(() => expect(sent.updated).toBeDefined())
      expect(sent.updated).toEqual({ site: { settings: { work_hours: { start: '06:00', end: '17:00' } } } })
    })

    it('shows a site\'s own settings as its own, with the rest following the company', async () => {
      serve(response({ sites: [site({ settings: { timezone: 'Asia/Colombo', work_days: [1, 2, 3, 4, 5, 6] } })] }))
      renderPage()

      expect(await screen.findByLabelText('Time zone')).toHaveValue('Asia/Colombo')
      expect(screen.getByLabelText('Same as the company (08:00 – 17:00)')).toBeChecked()
      expect(screen.getByLabelText('Sat')).toBeChecked()
    })

    it('adds and removes a holiday of the site\'s own', async () => {
      const user = userEvent.setup()
      const sent = serve(response())
      renderPage()

      await user.click(await screen.findByLabelText('1 from the company'))
      await user.click(screen.getByRole('button', { name: 'Add holiday' }))
      await user.type(screen.getByLabelText('Name'), 'Founders day')
      await user.type(screen.getByLabelText('Date'), '2026-03-01')
      await user.click(screen.getByLabelText('Every year'))
      await user.click(screen.getByRole('button', { name: 'Save calendar' }))

      await waitFor(() => expect(sent.updated).toBeDefined())
      expect(sent.updated).toEqual({ site: { settings: { holidays: [{ date: '2026-03-01', name: 'Founders day', repeating: true }] } } })
      await user.click(screen.getByRole('button', { name: 'Remove Founders day' }))
      expect(screen.getByText('No holidays')).toBeInTheDocument()
    })
  })

  describe('who works at a site', () => {
    it('lists everyone but administrators and people who are no longer active, with this site\'s people ticked', async () => {
      serve(response())
      renderPage()

      expect(await screen.findByLabelText(/Nora North/)).toBeChecked()
      expect(screen.getByLabelText(/Sam South/)).not.toBeChecked()
      expect(screen.queryByLabelText(/Ada Admin/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Gone Gary/)).not.toBeInTheDocument()
    })

    it('saves the people ticked', async () => {
      const user = userEvent.setup()
      const sent = serve(response())
      renderPage()

      await user.click(await screen.findByLabelText(/Sam South/))
      await user.click(screen.getByLabelText(/Nora North/))
      await user.click(screen.getByRole('button', { name: 'Save people' }))

      await waitFor(() => expect(sent.people).toEqual({ user_ids: [6] }))
    })
  })

  it('offers a way to try again when the sites cannot be loaded', async () => {
    server.use(http.get('/api/v1/sites', () => HttpResponse.json({}, { status: 500 })), http.get('/api/v1/users', () => HttpResponse.json({ users: [], meta: {} })))
    renderPage()

    expect(await screen.findByText('The sites could not be loaded.')).toBeInTheDocument()
    expect(within(screen.getByRole('alert').parentElement as HTMLElement).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('reads in Spanish', async () => {
    await setLanguage('es', false)
    serve(response())
    renderPage()

    expect(await screen.findByLabelText('Trabajar con varias sedes')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar calendario' })).toBeInTheDocument()
    expect(screen.getByLabelText('Igual que la empresa (America/New_York)')).toBeChecked()
  })
})
