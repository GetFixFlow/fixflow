import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { PurchasingPage } from '../PurchasingPage'
import type { PurchaseOrder, PurchaseOrderStatus, Role } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const lines = [
  { id: 11, part_id: 5, part_name: 'Hydraulic seal', part_sku: 'SEAL-1', unit: 'each', quantity: 6, unit_cost: 4.5, quantity_received: 0, total: 27 },
  { id: 12, part_id: 6, part_name: 'Belt', part_sku: null, unit: 'each', quantity: 2, unit_cost: null, quantity_received: 0, total: null },
]
const order = (id: number, status: PurchaseOrderStatus, extra: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id, number: `PO-00000${id}`, status, line_count: 2, total: 27, editable: status === 'requested' || status === 'approved',
  requested_by: { id: 7, name: 'Tina Tech' }, reason: 'Pump keeps leaking', created_at: '2026-10-20T09:00:00Z', updated_at: '', lines, ...extra,
})
const meta = (n: number) => ({ current_page: 1, total_pages: 1, total_count: n, per_page: 25 })

function signInAs(role: Role, id = 1) {
  useAuthStore.setState({
    user: { id, email: 'a@b.c', full_name: 'Test', role, organization_id: 1 } as never,
    token: 't', isAuthenticated: true,
  })
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter><PurchasingPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

let current: PurchaseOrder
let statusAsked: string | null
let sent: Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  signInAs('manager')
  statusAsked = null
  sent = {}
  current = order(1, 'requested')
  server.use(
    http.get('/api/v1/purchase_orders', ({ request }) => {
      statusAsked = new URL(request.url).searchParams.get('status')
      return HttpResponse.json({ purchase_orders: [current, order(2, 'received', { total: 90 })], waiting_for_approval: 1, meta: meta(2) })
    }),
    http.get('/api/v1/purchase_orders/:id', () => HttpResponse.json({ data: current })),
    http.get('/api/v1/vendors', () => HttpResponse.json({ vendors: [{ id: 3, name: 'Acme Supply', active: true }], categories: [], meta: meta(1) })),
    http.get('/api/v1/parts', () =>
      HttpResponse.json({ parts: [{ id: 5, name: 'Hydraulic seal', sku: 'SEAL-1', unit: 'each', quantity_on_hand: 1, reorder_point: 4, unit_cost: 4.5 }], meta: meta(1) })),
  )
  const step = (name: string, to: PurchaseOrderStatus) =>
    http.post(`/api/v1/purchase_orders/:id/${name}`, async ({ request }) => {
      sent = { step: name, ...(await request.json().catch(() => ({}))) as object }
      current = { ...current, status: to }
      return HttpResponse.json({ data: current })
    })
  server.use(step('approve', 'approved'), step('reject', 'rejected'), step('order', 'ordered'), step('receive', 'partially_received'),
    step('close', 'received'), step('cancel', 'cancelled'))
})

describe('PurchasingPage', () => {
  it('lists the open orders with who asked, the vendor, the total and where each has got to, and how many wait for a decision', async () => {
    renderPage()

    const row = (await screen.findByRole('button', { name: 'PO-000001' })).closest('tr')!
    expect(within(row).getByText('Tina Tech')).toBeInTheDocument()
    expect(within(row).getByText('Waiting for approval')).toBeInTheDocument()
    expect(screen.getByText('1 waiting for your decision')).toBeInTheDocument()
    expect(statusAsked).toBe('requested,approved,ordered,partially_received')
  })

  it('shows another set of orders when a tab is chosen', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'PO-000001' })

    await userEvent.click(screen.getByRole('tab', { name: /^On order/ }))

    await waitFor(() => expect(statusAsked).toBe('ordered,partially_received'))
    await userEvent.click(screen.getByRole('tab', { name: 'All' }))
    await waitFor(() => expect(statusAsked).toBeNull())
  })

  it('lets a technician ask for parts: the part found by search, a quantity, a reason', async () => {
    signInAs('technician', 7)
    let body: unknown
    server.use(http.post('/api/v1/purchase_orders', async ({ request }) => {
      body = await request.json()
      return HttpResponse.json({ data: order(3, 'requested') }, { status: 201 })
    }))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Ask for parts' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add part' }))
    await userEvent.click(await screen.findByRole('button', { name: /Hydraulic seal/ }))
    const how = screen.getByLabelText('How many Hydraulic seal')
    expect(how).toHaveValue(7) // back above the reorder point with a little over: 4 x 2 - 1
    await userEvent.clear(how)
    await userEvent.type(how, '6')
    await userEvent.type(screen.getByLabelText('Why is it needed?'), 'Pump keeps leaking')
    expect(screen.queryByLabelText('Cost of Hydraulic seal')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(body).toEqual({ purchase_order: { reason: 'Pump keeps leaking', notes: null }, lines: [{ part_id: 5, quantity: 6 }] }))
    expect(toast.success).toHaveBeenCalledWith('Request sent.')
  })

  it('will not send a request with no parts, or with a quantity of nothing', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Ask for parts' }))

    await userEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(await screen.findByText('Add at least one part.')).toBeInTheDocument()
  })

  it('lets a manager approve a request', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))

    expect(await screen.findByText('Hydraulic seal')).toBeInTheDocument()
    expect(screen.getByText('Pump keeps leaking')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(sent).toMatchObject({ step: 'approve' }))
    expect(toast.success).toHaveBeenCalledWith('Approved.')
  })

  it('asks why before turning a request down', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Turn down' }))

    const turnDownButtons = screen.getAllByRole('button', { name: 'Turn down' })
    const confirmButton = turnDownButtons[turnDownButtons.length - 1]
    expect(confirmButton).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Why is it turned down?'), 'Use Store B')
    await userEvent.click(confirmButton)

    await waitFor(() => expect(sent).toEqual({ step: 'reject', reason: 'Use Store B' }))
  })

  it('orders an approved request from a vendor, with the date and their reference', async () => {
    current = order(1, 'approved')
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Place order' }))

    expect(screen.getByRole('button', { name: 'Mark as ordered' })).toBeDisabled()
    await userEvent.selectOptions(await screen.findByLabelText('Order from'), 'Acme Supply')
    await userEvent.type(screen.getByLabelText('Their order or quote number'), 'Q-1182')
    await userEvent.click(screen.getByRole('button', { name: 'Mark as ordered' }))

    await waitFor(() => expect(sent).toEqual({ step: 'order', vendor_id: 3, expected_on: null, supplier_reference: 'Q-1182' }))
  })

  it('records a delivery, starting from what is still to come, and sends only what arrived', async () => {
    current = order(1, 'ordered', { vendor: { id: 3, name: 'Acme Supply' } })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Record delivery' }))

    const seal = screen.getByLabelText('Arrived: Hydraulic seal')
    expect(seal).toHaveValue(6)
    await userEvent.clear(seal)
    await userEvent.type(seal, '4')
    await userEvent.clear(screen.getByLabelText('Arrived: Belt'))
    await userEvent.click(screen.getByRole('button', { name: 'Add to stock' }))

    await waitFor(() => expect(sent).toEqual({ step: 'receive', lines: [{ id: 11, quantity: 4 }] }))
    expect(toast.success).toHaveBeenCalledWith('Received. The stock is updated.')
  })

  it('offers a technician only to change or cancel their own waiting request', async () => {
    signInAs('technician', 7)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))
    await screen.findByText('Hydraulic seal')

    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn down' })).not.toBeInTheDocument()
  })

  it('offers a technician nothing on a colleague’s request or one already approved', async () => {
    signInAs('technician', 8)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))
    await screen.findByText('Hydraulic seal')
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Cancel (request|order)$/ })).not.toBeInTheDocument()
  })

  it('offers a technician nothing on their own request once it has been approved', async () => {
    signInAs('technician', 7)
    current = order(1, 'approved')
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))
    await screen.findByText('Hydraulic seal')

    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Cancel (request|order)$/ })).not.toBeInTheDocument()
  })

  it('asks only for the parts still to come when part of an order has already arrived', async () => {
    current = order(1, 'partially_received', {
      lines: [{ ...lines[0], quantity_received: 6 }, { ...lines[1], quantity_received: 1 }],
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Record delivery' }))

    expect(screen.queryByLabelText('Arrived: Hydraulic seal')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Arrived: Belt')).toHaveValue(1)
  })

  it('shows why a request was turned down', async () => {
    current = order(1, 'rejected', { rejection_reason: 'Use Store B', decided_by: { id: 1, name: 'Mia Manager' } })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'PO-000001' }))

    expect(await screen.findByText('Turned down by Mia Manager: Use Store B')).toBeInTheDocument()
  })
})
