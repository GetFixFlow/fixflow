import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { resetDevice, setOnline, signInAs } from '@/test/offline'
import { offlineQueue } from '@/lib/offlineQueue'
import { apiClient } from '@/api/client'
import { WorkOrderDetailPage } from '../WorkOrderDetailPage'
import type { ChecklistItem, WorkOrder } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const steps = (): ChecklistItem[] => [
  { step: 1, instruction: 'Shut down pump safely', required: true, completed: true, completed_by_name: 'Tess Tech', completed_at: '2026-10-05T14:20:00Z' },
  { step: 2, instruction: 'Drain old oil', required: true, completed: false },
  { step: 3, instruction: 'Take a photo', required: false, completed: false },
]

const workOrder = (extra: Partial<WorkOrder> = {}): WorkOrder => ({
  id: 1, work_order_number: 'WO-000001', title: 'Monthly oil change', status: 'in_progress', priority: 'medium',
  organization_id: 1, assignee_id: 7, assignee: { id: 7, full_name: 'Tess Tech', email: '', role: 'technician' },
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', checklist: steps(), ...extra,
})

function serve(wo: WorkOrder) {
  server.use(
    http.get(`/api/v1/work_orders/${wo.id}`, () => HttpResponse.json({ data: wo })),
    http.get(`/api/v1/work_orders/${wo.id}/comments`, () => HttpResponse.json({ comments: [] })),
    http.get(`/api/v1/work_orders/${wo.id}/attachments`, () => HttpResponse.json({ attachments: [] })),
    http.get(`/api/v1/work_orders/${wo.id}/parts`, () => HttpResponse.json({ parts: [] })),
  )
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/work-orders/1']}>
        <Routes><Route path="/work-orders/:id" element={<WorkOrderDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetDevice()
  signInAs(7, 'technician', 'Tess Tech')
})

describe('the checklist on a work order', () => {
  it('is shown, with progress and who did each step (it was never shown before: the page read the wrong field)', async () => {
    serve(workOrder())
    renderPage()

    expect(await screen.findByText('Shut down pump safely')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Drain old oil' })).toBeInTheDocument()
    expect(screen.getByText('1/3 steps completed')).toBeInTheDocument()
    expect(screen.getByText(/Done by Tess Tech/)).toBeInTheDocument()
  })

  it('is not shown for a work order that has none', async () => {
    serve(workOrder({ checklist: [] }))
    renderPage()

    await screen.findByText('Monthly oil change')
    expect(screen.queryByText(/steps completed/)).not.toBeInTheDocument()
  })

  it('reminds the technician which required steps are left, and not the optional ones', async () => {
    serve(workOrder())
    renderPage()

    expect(await screen.findByText(/1 required step not complete/)).toBeInTheDocument()
    expect(screen.getAllByText('Drain old oil').length).toBeGreaterThan(1) // in the list and in the reminder
    expect(screen.getByText('Take a photo')).toBeInTheDocument()
  })

  it('treats a step as required unless it says it is not', async () => {
    serve(workOrder({ checklist: [{ step: 1, instruction: 'Inspect belt', completed: false }] }))
    renderPage()

    expect(await screen.findByText('*required')).toBeInTheDocument()
  })

  it('ticks a step at once and sends only that step', async () => {
    serve(workOrder())
    let body: { work_order: { checklist: Array<Record<string, unknown>> } } | undefined
    let ticked = false
    server.use(
      http.patch('/api/v1/work_orders/1', async ({ request }) => {
        body = (await request.json()) as typeof body
        ticked = true
        return HttpResponse.json({ data: workOrder() })
      }),
      // After the tick, the server's copy has it.
      http.get('/api/v1/work_orders/1', () =>
        HttpResponse.json({ data: workOrder({ checklist: steps().map((i) => (ticked && i.step === 2 ? { ...i, completed: true } : i)) }) })),
    )
    renderPage()

    const box = await screen.findByRole('checkbox', { name: 'Drain old oil' })
    await userEvent.click(box)

    await waitFor(() => expect(box).toBeChecked())
    await waitFor(() => expect(body).toBeDefined())
    expect(body?.work_order.checklist).toEqual([{ step: 2, completed: true }])
    expect(await screen.findByText('2/3 steps completed')).toBeInTheDocument()
  })

  it('puts the tick back and says why when the server refuses it', async () => {
    serve(workOrder())
    server.use(http.patch('/api/v1/work_orders/1', () =>
      HttpResponse.json({ error: { code: 'CHECKLIST_LOCKED', message: 'This work order is completed, so its checklist can no longer be changed.' } }, { status: 422 })))
    renderPage()

    const box = await screen.findByRole('checkbox', { name: 'Drain old oil' })
    await userEvent.click(box)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This work order is completed, so its checklist can no longer be changed.'))
    await waitFor(() => expect(box).not.toBeChecked())
  })

  it('keeps a tick made without a connection, shows it as waiting, and sends only that step later', async () => {
    serve(workOrder())
    renderPage()
    const box = await screen.findByRole('checkbox', { name: 'Drain old oil' })
    setOnline(false)

    await userEvent.click(box)

    await waitFor(() => expect(within(box.closest('li')!).getByText('Waiting to sync')).toBeInTheDocument())
    expect(box).toBeChecked()
    expect(offlineQueue.getSnapshot().queue).toMatchObject([{ type: 'checklist', workOrderId: 1, step: 2, completed: true }])
    expect(screen.getByText('2/3 steps completed')).toBeInTheDocument()
  })

  it('cannot be changed once the work order is completed', async () => {
    serve(workOrder({ status: 'completed', completed_at: '2026-10-05T16:00:00Z' }))
    renderPage()

    expect(await screen.findByRole('checkbox', { name: 'Drain old oil' })).toBeDisabled()
  })

  it('cannot be changed by someone who is neither the technician nor a manager', async () => {
    signInAs(99, 'requester', 'Rita Requester')
    serve(workOrder())
    renderPage()

    expect(await screen.findByRole('checkbox', { name: 'Drain old oil' })).toBeDisabled()
  })

  it('can be ticked by a manager too', async () => {
    signInAs(50, 'manager', 'Mia Manager')
    serve(workOrder())
    renderPage()

    expect(await screen.findByRole('checkbox', { name: 'Drain old oil' })).toBeEnabled()
  })

  it('blocks completing the work order until the required steps are done, naming them', async () => {
    serve(workOrder())
    const post = vi.spyOn(apiClient, 'patch')
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /complete/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('1 required step not checked')
    expect(dialog).toHaveTextContent('Drain old oil')
    expect(post).not.toHaveBeenCalled()
  })
})
