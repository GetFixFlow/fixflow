import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { VendorsPage } from '../VendorsPage'
import type { Role } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const vendor = (id: number, name: string, extra: object = {}) => ({
  id, name, category: 'Electrical', phone: '555-0100', email: null, website: null, address: null, notes: null, active: true,
  work_orders_count: 0, created_at: '', updated_at: '', ...extra,
})
const meta = (n: number) => ({ current_page: 1, total_pages: 1, total_count: n, per_page: 25 })

function signInAs(role: Role) {
  useAuthStore.setState({
    user: { id: 1, email: 'a@b.c', full_name: 'Test', role, organization_id: 1 } as never,
    token: 't', isAuthenticated: true,
  })
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><VendorsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const acme = vendor(1, 'Acme Electric', { work_orders_count: 3, website: 'javascript:alert(1)' })
const chill = vendor(2, 'Chill Co', { category: 'HVAC', active: false, phone: null })
let created: unknown

beforeEach(() => {
  vi.clearAllMocks()
  created = undefined
  signInAs('admin')
  server.use(
    http.get('/api/v1/vendors', ({ request }) => {
      const url = new URL(request.url)
      const search = url.searchParams.get('search')?.toLowerCase()
      let rows = [acme, chill]
      if (search) rows = rows.filter((v) => v.name.toLowerCase().includes(search))
      if (url.searchParams.get('active') === 'true') rows = rows.filter((v) => v.active)
      return HttpResponse.json({ vendors: rows, categories: ['Electrical', 'HVAC'], meta: meta(rows.length) })
    }),
    http.get('/api/v1/vendors/1', () =>
      HttpResponse.json({ data: { ...acme, contacts: [{ id: 9, name: 'Priya', role: 'Dispatcher', phone: '555-0199', email: 'p@acme.example' }] } })),
    http.post('/api/v1/vendors', async ({ request }) => {
      created = await request.json()
      return HttpResponse.json({ data: vendor(3, 'Bolt Works') }, { status: 201 })
    }),
  )
})

describe('VendorsPage', () => {
  it('lists the vendors with what they do, how many work orders they have and whether they are in use', async () => {
    renderPage()

    const row = (await screen.findByRole('button', { name: 'Acme Electric' })).closest('tr')!
    expect(within(row).getByText('Electrical')).toBeInTheDocument()
    expect(within(row).getByText('3')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: 'Chill Co' }).closest('tr')!).getByText('Not in use')).toBeInTheDocument()
    expect(screen.getByText('2 in the list')).toBeInTheDocument()
  })

  it('searches by name as you type', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Acme Electric' })

    await userEvent.type(screen.getByLabelText('Search vendors'), 'chill')

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Acme Electric' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Chill Co' })).toBeInTheDocument()
    expect(screen.getByText('1 matching')).toBeInTheDocument()
  })

  it('opens a vendor to show the people to call, and does not turn a script address into a link', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Acme Electric' }))

    expect(await screen.findByText('Priya')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '555-0199' })).toHaveAttribute('href', 'tel:5550199')
    expect(screen.getByRole('link', { name: 'p@acme.example' })).toHaveAttribute('href', 'mailto:p@acme.example')
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'javascript:alert(1)' })).not.toBeInTheDocument()
  })

  it('lets a manager add a vendor, sending an empty field as nothing', async () => {
    signInAs('manager')
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Add vendor' }))

    await userEvent.type(screen.getByLabelText('Name *'), 'Bolt Works')
    await userEvent.type(screen.getByLabelText('What they do'), 'Welding')
    await userEvent.click(screen.getByRole('button', { name: 'Add vendor', hidden: false, description: '' }))

    await waitFor(() => expect(created).toBeTruthy())
    expect(created).toEqual({ vendor: { name: 'Bolt Works', category: 'Welding', phone: null, email: null, website: null, address: null, notes: null } })
    expect(toast.success).toHaveBeenCalledWith('Vendor added.')
  })

  it('asks for a name, and for a real email address', async () => {
    signInAs('manager')
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Add vendor' }))

    await userEvent.type(screen.getByLabelText('Email'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'Add vendor', description: '' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Enter a real email address')).toBeInTheDocument()
    expect(created).toBeUndefined()
  })

  it('shows a technician the list and the contacts, with nothing to change', async () => {
    signInAs('technician')
    renderPage()
    await screen.findByRole('button', { name: 'Acme Electric' })

    expect(screen.queryByRole('button', { name: 'Add vendor' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Edit Acme Electric')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Delete Acme Electric')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Acme Electric' }))
    await screen.findByText('Priya')
    expect(screen.queryByRole('button', { name: 'Add contact' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Remove Priya')).not.toBeInTheDocument()
  })

  it("says why a vendor that has work orders cannot be deleted", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(http.delete('/api/v1/vendors/1', () =>
      HttpResponse.json({ error: { code: 'VENDOR_IN_USE', message: 'This vendor has work orders, so it cannot be deleted. Deactivate it instead.' } }, { status: 422 })))
    renderPage()

    await userEvent.click(await screen.findByLabelText('Delete Acme Electric'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This vendor has work orders, so it cannot be deleted. Deactivate it instead.'))
  })

  it('says so when there are none yet, and tells a technician who to ask', async () => {
    server.use(http.get('/api/v1/vendors', () => HttpResponse.json({ vendors: [], categories: [], meta: meta(0) })))
    signInAs('technician')
    renderPage()

    expect(await screen.findByText('No vendors yet')).toBeInTheDocument()
    expect(screen.getByText('A manager can add the contractors you use.')).toBeInTheDocument()
  })
})
