import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { DEFAULT_LOCALE, useLocaleStore } from '@/lib/localeFormat'
import { WorkOrderVendor } from '../WorkOrderVendor'
import type { WorkOrder } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const workOrder = (extra: Partial<WorkOrder> = {}): WorkOrder =>
  ({ id: 5, work_order_number: 'WO-000005', title: 'Rewire', status: 'in_progress', priority: 'medium', organization_id: 1,
     created_at: '', updated_at: '', vendor_id: null, vendor: null, ...extra }) as WorkOrder

const vendors = [
  { id: 1, name: 'Acme Electric', active: true, work_orders_count: 0 },
  { id: 2, name: 'Chill Co', active: true, work_orders_count: 0 },
]
let patched: unknown

function renderPanel(wo: WorkOrder, canManage: boolean) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <WorkOrderVendor workOrder={wo} canManage={canManage} />
  </QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  patched = undefined
  localStorage.clear()
  useLocaleStore.setState({ locale: DEFAULT_LOCALE })
  server.use(
    http.get('/api/v1/vendors', () => HttpResponse.json({ vendors, categories: [], meta: { current_page: 1, total_pages: 1, total_count: 2, per_page: 25 } })),
    http.patch('/api/v1/work_orders/5', async ({ request }) => {
      patched = await request.json()
      return HttpResponse.json({ data: workOrder() })
    }),
  )
})

describe('WorkOrderVendor', () => {
  it('shows a manager who is doing the work, what they charged and their invoice number', () => {
    renderPanel(workOrder({ vendor_id: 1, vendor: { id: 1, name: 'Acme Electric' }, vendor_cost: '1250.50', vendor_reference: 'INV-77' }), true)

    expect(screen.getByText('Acme Electric')).toBeInTheDocument()
    expect(screen.getByText('$1,250.50')).toBeInTheDocument()
    expect(screen.getByText('INV-77')).toBeInTheDocument()
  })

  it('shows a technician the company but not what it charged, even if the amount were sent', () => {
    renderPanel(workOrder({ vendor_id: 1, vendor: { id: 1, name: 'Acme Electric' }, vendor_cost: '999.00', vendor_reference: 'LEAK-1' }), false)

    expect(screen.getByText('Acme Electric')).toBeInTheDocument()
    expect(screen.queryByText(/charged/i)).not.toBeInTheDocument()
    expect(screen.queryByText('$999.00')).not.toBeInTheDocument()
    expect(screen.queryByText('LEAK-1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows a technician nothing when the work is in-house', () => {
    renderPanel(workOrder(), false)

    expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
  })

  it('lets a manager give the work order to a vendor with the charge and invoice number', async () => {
    renderPanel(workOrder(), true)
    await userEvent.click(screen.getByRole('button', { name: 'Give to a vendor' }))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Electric' })).toBeInTheDocument())

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Vendor' }), 'Acme Electric')
    await userEvent.type(screen.getByLabelText('What they charged'), '800.5')
    await userEvent.type(screen.getByLabelText('Invoice or quote no.'), 'Q-1')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(patched).toBeTruthy())
    expect(patched).toEqual({ work_order: { vendor_id: 1, vendor_cost: 800.5, vendor_reference: 'Q-1' } })
  })

  it('takes the work order off the vendor, clearing the charge', async () => {
    renderPanel(workOrder({ vendor_id: 1, vendor: { id: 1, name: 'Acme Electric' }, vendor_cost: '80', vendor_reference: 'X' }), true)
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chill Co' })).toBeInTheDocument())

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Vendor' }), 'No vendor (done in-house)')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(patched).toEqual({ work_order: { vendor_id: null, vendor_cost: 0, vendor_reference: null } }))
  })

  it("keeps a vendor that has since been switched off in the list, marked", async () => {
    renderPanel(workOrder({ vendor_id: 9, vendor: { id: 9, name: 'Old Co' } }), true)
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))

    expect(await screen.findByRole('option', { name: 'Old Co (not in use)' })).toBeInTheDocument()
  })

  it('refuses a negative charge before sending anything', async () => {
    renderPanel(workOrder(), true)
    await userEvent.click(screen.getByRole('button', { name: 'Give to a vendor' }))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Electric' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Vendor' }), 'Acme Electric')

    await userEvent.type(screen.getByLabelText('What they charged'), '-5')

    expect(screen.getByText('Enter an amount of 0 or more')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(patched).toBeUndefined()
  })

  it("says what the server said when it refuses", async () => {
    server.use(http.patch('/api/v1/work_orders/5', () =>
      HttpResponse.json({ error: { message: 'Vendor is deactivated and cannot be given new work' } }, { status: 422 })))
    renderPanel(workOrder(), true)
    await userEvent.click(screen.getByRole('button', { name: 'Give to a vendor' }))
    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Electric' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Vendor' }), 'Acme Electric')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Vendor is deactivated and cannot be given new work'))
  })

  it('offers no change once the work order is verified or cancelled', () => {
    renderPanel(workOrder({ status: 'verified', vendor_id: 1, vendor: { id: 1, name: 'Acme Electric' }, vendor_cost: '10' }), true)

    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
  })
})
