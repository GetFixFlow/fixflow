import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { PartLogModal } from '../modals/PartLogModal'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const part = (id: number, name: string, extra: object = {}) => ({
  id, name, sku: `SKU-${id}`, quantity_on_hand: 5, reorder_point: 1, unit: 'each', unit_cost: 12.5,
  organization_id: 1, created_at: '', updated_at: '', ...extra,
})

function serveCatalog(parts: object[]) {
  server.use(http.get('/api/v1/parts', ({ request }) => {
    const search = new URL(request.url).searchParams.get('search')?.toLowerCase()
    const rows = search ? (parts as { name: string }[]).filter((p) => p.name.toLowerCase().includes(search)) : parts
    return HttpResponse.json({ parts: rows, meta: {} })
  }))
}

function renderModal(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PartLogModal workOrderId={7} open onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

describe('PartLogModal', () => {
  it('offers the real parts catalog, not placeholders', async () => {
    serveCatalog([part(1, 'Hydraulic seal'), part(2, 'Drive chain')])
    renderModal()

    expect(await screen.findByText('Hydraulic seal')).toBeInTheDocument()
    expect(screen.getByText('Drive chain')).toBeInTheDocument()
    expect(screen.queryByText('Oil Filter')).not.toBeInTheDocument() // the old invented part
  })

  it('searches the catalog as you type', async () => {
    serveCatalog([part(1, 'Hydraulic seal'), part(2, 'Drive chain')])
    renderModal()
    await screen.findByText('Hydraulic seal')

    await userEvent.type(screen.getByLabelText(/part \*/i), 'chain')

    await waitFor(() => expect(screen.queryByText('Hydraulic seal')).not.toBeInTheDocument())
    expect(screen.getByText('Drive chain')).toBeInTheDocument()
  })

  it('says so when there are no parts, and when nothing matches', async () => {
    serveCatalog([])
    renderModal()
    expect(await screen.findByText(/no parts have been added yet/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/part \*/i), 'zzz')
    expect(await screen.findByText(/no parts match that search/i)).toBeInTheDocument()
  })

  it('cannot pick a part that is out of stock', async () => {
    serveCatalog([part(1, 'Hydraulic seal', { quantity_on_hand: 0 })])
    renderModal()

    const row = await screen.findByRole('button', { name: /hydraulic seal/i })
    expect(row).toBeDisabled()
    expect(screen.getByText('Out of stock')).toBeInTheDocument()
  })

  it('fills in the unit cost from the catalog and totals the line', async () => {
    serveCatalog([part(1, 'Hydraulic seal', { unit_cost: 18 })])
    renderModal()
    await userEvent.click(await screen.findByRole('button', { name: /hydraulic seal/i }))

    expect(screen.getByLabelText(/unit cost/i)).toHaveValue(18)
    await userEvent.clear(screen.getByLabelText(/quantity/i))
    await userEvent.type(screen.getByLabelText(/quantity/i), '3')
    expect(screen.getByText('$54.00')).toBeInTheDocument()
  })

  it('will not log more than is in stock', async () => {
    serveCatalog([part(1, 'Hydraulic seal', { quantity_on_hand: 2 })])
    renderModal()
    await userEvent.click(await screen.findByRole('button', { name: /hydraulic seal/i }))
    await userEvent.clear(screen.getByLabelText(/quantity/i))
    await userEvent.type(screen.getByLabelText(/quantity/i), '3')

    expect(screen.getByRole('alert')).toHaveTextContent(/exceeds the stock on hand \(2\)/i)
    expect(screen.getByRole('button', { name: /log parts/i })).toBeDisabled()
  })

  it('logs the part with the shape the API reads, then closes', async () => {
    let body: unknown
    serveCatalog([part(4, 'Hydraulic seal', { unit_cost: 18 })])
    server.use(http.post('/api/v1/work_orders/7/parts', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ data: { id: 1 } }, { status: 201 })
    }))
    const onClose = renderModal()

    await userEvent.click(await screen.findByRole('button', { name: /hydraulic seal/i }))
    await userEvent.clear(screen.getByLabelText(/quantity/i))
    await userEvent.type(screen.getByLabelText(/quantity/i), '2')
    await userEvent.click(screen.getByRole('button', { name: /log parts/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(body).toEqual({ part: { part_id: 4, quantity_used: 2, unit_cost: 18 } })
  })

  it('shows the server reason when it refuses, and stays open', async () => {
    serveCatalog([part(1, 'Hydraulic seal')])
    server.use(http.post('/api/v1/work_orders/7/parts', () =>
      HttpResponse.json({ error: { code: 'INSUFFICIENT_STOCK', message: 'Only 1.0 each of Hydraulic seal in stock.' } }, { status: 422 }),
    ))
    const onClose = renderModal()
    await userEvent.click(await screen.findByRole('button', { name: /hydraulic seal/i }))
    await userEvent.click(screen.getByRole('button', { name: /log parts/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Only 1.0 each of Hydraulic seal in stock.'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
