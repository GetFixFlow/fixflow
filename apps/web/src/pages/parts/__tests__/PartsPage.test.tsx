import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { PartsPage } from '../PartsPage'
import type { Role } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const part = (id: number, name: string, extra: object = {}) => ({
  id, name, sku: `SKU-${id}`, quantity_on_hand: 10, reorder_point: 2, unit: 'each', unit_cost: 12.5, low_stock: false,
  organization_id: 1, created_at: '', updated_at: '', ...extra,
})
const meta = (n: number, pages = 1, current = 1) => ({ current_page: current, total_pages: pages, total_count: n, per_page: 25 })

function signInAs(role: Role) {
  useAuthStore.setState({
    user: { id: 1, email: 'a@b.c', full_name: 'Test', role, organization_id: 1 } as never,
    token: 't', isAuthenticated: true,
  })
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><PartsPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const seal = part(1, 'Hydraulic seal')
const chain = part(2, 'Drive chain', { quantity_on_hand: 1, reorder_point: 2, low_stock: true })
const gone = part(3, 'Fuse', { quantity_on_hand: 0, low_stock: true })

beforeEach(() => {
  vi.clearAllMocks()
  signInAs('admin')
  server.use(http.get('/api/v1/parts', ({ request }) => {
    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.toLowerCase()
    let rows = [seal, chain, gone]
    if (search) rows = rows.filter((p) => p.name.toLowerCase().includes(search))
    if (url.searchParams.get('low_stock') === 'true') rows = rows.filter((p) => p.low_stock)
    return HttpResponse.json({ parts: rows, meta: meta(rows.length) })
  }))
})

describe('PartsPage', () => {
  it('lists the catalog with stock status and cost', async () => {
    renderPage()

    const row = (await screen.findByText('Drive chain')).closest('tr')!
    expect(within(row).getByText('Low')).toBeInTheDocument()
    expect(within(screen.getByText('Fuse').closest('tr')!).getByText('Out of stock')).toBeInTheDocument()
    expect(within(screen.getByText('Hydraulic seal').closest('tr')!).getByText('In stock')).toBeInTheDocument()
    expect(screen.getAllByText('$12.50').length).toBeGreaterThan(0)
    expect(screen.getByText('3 in the catalog')).toBeInTheDocument()
  })

  it('starts a purchase request from a part, with enough to get back above its reorder point', async () => {
    signInAs('technician')
    let body: unknown
    server.use(http.post('/api/v1/purchase_orders', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ data: {} }, { status: 201 })
    }))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Ask for more Drive chain' }))

    expect(screen.getByLabelText('How many Drive chain')).toHaveValue(3) // 2 x 2 - 1 on hand
    expect(screen.getByLabelText('Why is it needed?')).toHaveValue('Drive chain is running low')
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }))
    await waitFor(() => expect(body).toEqual({ purchase_order: { reason: 'Drive chain is running low', notes: null }, lines: [{ part_id: 2, quantity: 3 }] }))
  })

  it('searches by name as you type', async () => {
    renderPage()
    await screen.findByText('Hydraulic seal')

    await userEvent.type(screen.getByLabelText('Search parts'), 'chain')

    await waitFor(() => expect(screen.queryByText('Hydraulic seal')).not.toBeInTheDocument())
    expect(screen.getByText('Drive chain')).toBeInTheDocument()
  })

  it('can show just the parts to reorder', async () => {
    renderPage()
    await screen.findByText('Hydraulic seal')

    await userEvent.click(screen.getByLabelText('Low stock only'))

    await waitFor(() => expect(screen.queryByText('Hydraulic seal')).not.toBeInTheDocument())
    expect(screen.getByText('Drive chain')).toBeInTheDocument()
    expect(screen.getByText('Fuse')).toBeInTheDocument()
  })

  it('says so when there are no parts, and offers to add one', async () => {
    server.use(http.get('/api/v1/parts', () => HttpResponse.json({ parts: [], meta: meta(0) })))
    renderPage()

    expect(await screen.findByText('No parts yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add part' }).length).toBeGreaterThan(0)
  })

  it('says so when it could not load, instead of showing an empty catalog', async () => {
    server.use(http.get('/api/v1/parts', () => HttpResponse.json({}, { status: 500 })))
    renderPage()

    expect(await screen.findByText('The parts could not be loaded')).toBeInTheDocument()
    expect(screen.queryByText('No parts yet')).not.toBeInTheDocument()
  })

  it('adds a part, sending the starting stock', async () => {
    let body: { part: Record<string, unknown> } | undefined
    server.use(http.post('/api/v1/parts', async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json(part(9, 'Bearing'), { status: 201 })
    }))
    renderPage()
    await screen.findByText('Hydraulic seal')

    await userEvent.click(screen.getByRole('button', { name: /add part/i }))
    await userEvent.type(screen.getByLabelText(/name \*/i), 'Bearing')
    await userEvent.type(screen.getByLabelText('SKU'), 'BR-1')
    await userEvent.clear(screen.getByLabelText('Starting stock'))
    await userEvent.type(screen.getByLabelText('Starting stock'), '8')
    await userEvent.type(screen.getByLabelText('Unit cost'), '45')
    await userEvent.click(screen.getByRole('button', { name: 'Add part', hidden: false }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Part added.'))
    expect(body?.part).toMatchObject({ name: 'Bearing', sku: 'BR-1', quantity_on_hand: 8, unit_cost: 45, unit: 'each' })
  })

  it('needs a name, and a cost that is not negative', async () => {
    renderPage()
    await screen.findByText('Hydraulic seal')

    await userEvent.click(screen.getByRole('button', { name: /add part/i }))
    await userEvent.type(screen.getByLabelText('Unit cost'), '-3')
    await userEvent.click(screen.getByRole('button', { name: 'Add part' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Unit cost must be 0 or more')).toBeInTheDocument()
  })

  it('edits a part without sending the stock level', async () => {
    let body: { part: Record<string, unknown> } | undefined
    server.use(http.patch('/api/v1/parts/1', async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json(seal)
    }))
    renderPage()

    await userEvent.click(await screen.findByLabelText('Edit Hydraulic seal'))
    expect(screen.queryByLabelText('Starting stock')).not.toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Unit cost'))
    await userEvent.type(screen.getByLabelText('Unit cost'), '20')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Part updated.'))
    expect(body?.part).toMatchObject({ unit_cost: 20 })
    expect(body?.part).not.toHaveProperty('quantity_on_hand')
  })

  it('adjusts stock, showing the result first, and sends the reason', async () => {
    let body: Record<string, unknown> | undefined
    server.use(http.patch('/api/v1/parts/1/adjust_stock', async ({ request }) => {
      body = (await request.json()) as typeof body
      return HttpResponse.json(seal)
    }))
    renderPage()

    await userEvent.click(await screen.findByLabelText('Adjust stock of Hydraulic seal'))
    await userEvent.click(screen.getByRole('radio', { name: 'Remove stock' }))
    await userEvent.type(screen.getByLabelText(/quantity/i), '4')
    expect(screen.getByText('6')).toBeInTheDocument() // 10 → 6
    await userEvent.type(screen.getByLabelText('Reason'), 'Stock count')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Stock updated.'))
    expect(body).toEqual({ quantity: 4, direction: 'remove', reason: 'Stock count' })
  })

  it('will not remove more than is in stock, and sends nothing', async () => {
    const adjust = vi.fn()
    server.use(http.patch('/api/v1/parts/2/adjust_stock', () => { adjust(); return HttpResponse.json(chain) }))
    renderPage()

    await userEvent.click(await screen.findByLabelText('Adjust stock of Drive chain'))
    await userEvent.click(screen.getByRole('radio', { name: 'Remove stock' }))
    await userEvent.type(screen.getByLabelText(/quantity/i), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Only 1 each in stock.')).toBeInTheDocument()
    expect(adjust).not.toHaveBeenCalled()
  })

  it('shows the server\'s reason when a part cannot be deleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(http.delete('/api/v1/parts/1', () =>
      HttpResponse.json({ success: false, error: { code: 'PART_IN_USE', message: 'Hydraulic seal has been used on work orders.' } }, { status: 422 })))
    renderPage()

    await userEvent.click(await screen.findByLabelText('Delete Hydraulic seal'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Hydraulic seal has been used on work orders.'))
  })

  it('offers managers a way to import parts from a CSV file, and nobody else', async () => {
    signInAs('manager')
    renderPage()
    expect(await screen.findByRole('link', { name: /import csv/i })).toHaveAttribute('href', '/import?kind=parts')
  })

  it('leaves adding, editing and deleting to the people allowed to', async () => {
    signInAs('technician')
    renderPage()
    await screen.findByText('Hydraulic seal')

    expect(screen.getByLabelText('Adjust stock of Hydraulic seal')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add part/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /import csv/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Edit Hydraulic seal')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Delete Hydraulic seal')).not.toBeInTheDocument()
  })

  it('pages through a long catalog', async () => {
    const pages: string[] = []
    server.use(http.get('/api/v1/parts', ({ request }) => {
      const page = new URL(request.url).searchParams.get('page') ?? '1'
      pages.push(page)
      return HttpResponse.json({ parts: [part(Number(page), `Part on page ${page}`)], meta: meta(40, 2, Number(page)) })
    }))
    renderPage()

    await screen.findByText('Part on page 1')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Part on page 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
