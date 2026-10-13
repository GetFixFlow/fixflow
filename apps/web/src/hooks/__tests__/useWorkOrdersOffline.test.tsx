import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import React from 'react'
import { server } from '@/test/server'
import { resetDevice, setOnline, signInAs } from '@/test/offline'
import { offlineQueue } from '@/lib/offlineQueue'
import {
  useCompleteWorkOrder,
  useCreateComment,
  useTransitionWorkOrder,
  useWorkOrder,
  useWorkOrderComments,
  useWorkOrders,
} from '../useWorkOrders'
import type { WorkOrder } from '@/types'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const wo = (extra: Partial<WorkOrder> = {}) =>
  ({ id: 1, work_order_number: 'WO-000001', title: 'Pump', status: 'assigned', priority: 'medium', organization_id: 1, created_at: '', updated_at: '', ...extra }) as WorkOrder

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  resetDevice()
  signInAs(7, 'technician', 'Tess Tech')
  server.use(
    http.get('/api/v1/work_orders/1', () => HttpResponse.json({ data: wo() })),
    http.get('/api/v1/work_orders', () => HttpResponse.json({ work_orders: [wo(), wo({ id: 2, work_order_number: 'WO-000002' })], meta: {} })),
    http.get('/api/v1/work_orders/1/comments', () => HttpResponse.json({ comments: [] })),
  )
})

describe('status changes without a connection', () => {
  it('keeps the change on the device instead of failing, and says so', async () => {
    const hit = vi.fn()
    server.use(http.patch('/api/v1/work_orders/1/transition', () => { hit(); return HttpResponse.json({ data: wo() }) }))
    setOnline(false)
    const { result } = renderHook(() => useTransitionWorkOrder(), { wrapper: wrapper() })

    await act(async () => { await result.current.mutateAsync({ id: 1, event: 'start' }) })

    expect(hit).not.toHaveBeenCalled()
    expect(offlineQueue.getSnapshot().queue).toMatchObject([{ type: 'transition', workOrderId: 1, event: 'start' }])
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Saved on this device'))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('keeps it too when the signal drops during the request, though the device thought it was online', async () => {
    server.use(http.patch('/api/v1/work_orders/1/transition', () => HttpResponse.error()))
    const { result } = renderHook(() => useTransitionWorkOrder(), { wrapper: wrapper() })

    await act(async () => { await result.current.mutateAsync({ id: 1, event: 'start' }) })

    expect(offlineQueue.getSnapshot().queue).toHaveLength(1)
  })

  it('still reports a refusal from the server as a failure, and keeps nothing', async () => {
    server.use(http.patch('/api/v1/work_orders/1/transition', () => HttpResponse.json({ error: { message: 'no' } }, { status: 422 })))
    const { result } = renderHook(() => useTransitionWorkOrder(), { wrapper: wrapper() })

    await act(async () => { await result.current.mutateAsync({ id: 1, event: 'start' }).catch(() => undefined) })

    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
    expect(toast.error).toHaveBeenCalled()
  })

  it('does not keep changes that need the server to decide, like assigning or verifying', async () => {
    server.use(http.patch('/api/v1/work_orders/1/transition', () => HttpResponse.error()))
    const { result } = renderHook(() => useTransitionWorkOrder(), { wrapper: wrapper() })

    await act(async () => { await result.current.mutateAsync({ id: 1, event: 'verify' }).catch(() => undefined) })

    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
    expect(toast.error).toHaveBeenCalled()
  })

  it('keeps completing a work order, with the notes and hours', async () => {
    setOnline(false)
    const { result } = renderHook(() => useCompleteWorkOrder(), { wrapper: wrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 1, completion_notes: 'Replaced the belt and tested', actual_hours: 2, resolution_type: 'fully_resolved' })
    })

    expect(offlineQueue.getSnapshot().queue[0]).toMatchObject({
      event: 'complete',
      payload: { work_order: { completion_notes: 'Replaced the belt and tested', actual_hours: 2 } },
    })
  })

  it('shows the work order already moved on, and as waiting to sync', async () => {
    const { result } = renderHook(() => useWorkOrder(1), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data?.status).toBe('assigned'))

    act(() => { offlineQueue.enqueue({ type: 'transition', workOrderId: 1, event: 'start', label: 'Start work on WO-000001' }) })

    expect(result.current.data).toMatchObject({ status: 'in_progress', pending_sync: 1 })
  })

  it('shows it in the lists too, only on the work order that changed', async () => {
    const { result } = renderHook(() => useWorkOrders(), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data?.work_orders).toHaveLength(2))

    act(() => { offlineQueue.enqueue({ type: 'transition', workOrderId: 2, event: 'start', label: 'x' }) })

    expect(result.current.data?.work_orders.map((w) => w.status)).toEqual(['assigned', 'in_progress'])
  })
})

describe('comments without a connection', () => {
  it('keeps the comment, shows it as waiting under the real ones, and does not post it twice later', async () => {
    const { result } = renderHook(() => ({ create: useCreateComment(1), comments: useWorkOrderComments(1) }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.comments.data).toEqual([])) // loaded while there was a signal
    setOnline(false)

    await act(async () => { await result.current.create.mutateAsync({ body: 'Belt replaced', internal: false }) })

    expect(result.current.comments.data).toMatchObject([{ body: 'Belt replaced', pending: true, user: { full_name: 'Tess Tech' } }])
    const [queued] = offlineQueue.getSnapshot().queue
    expect(queued).toMatchObject({ type: 'comment', body: 'Belt replaced', internal: false })
    expect((queued as { clientId: string }).clientId).toBeTruthy()
  })

  it('posts straight away when online, saying whether it is internal and carrying an id', async () => {
    let sent: { comment: Record<string, unknown> } | undefined
    server.use(http.post('/api/v1/work_orders/1/comments', async ({ request }) => {
      sent = (await request.json()) as typeof sent
      return HttpResponse.json({ data: {} }, { status: 201 })
    }))
    const { result } = renderHook(() => useCreateComment(1), { wrapper: wrapper() })

    await act(async () => { await result.current.mutateAsync({ body: 'Quote too high', internal: true }) })

    expect(sent?.comment).toMatchObject({ body: 'Quote too high', internal: true })
    expect(sent?.comment.client_id).toBeTruthy()
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
  })

  it('shows the server\'s reason when a comment is refused', async () => {
    server.use(http.post('/api/v1/work_orders/1/comments', () =>
      HttpResponse.json({ error: { message: 'Only managers can add internal notes.' } }, { status: 403 })))
    const { result } = renderHook(() => useCreateComment(1), { wrapper: wrapper() })

    await act(async () => { await result.current.mutateAsync({ body: 'x', internal: true }).catch(() => undefined) })

    expect(toast.error).toHaveBeenCalledWith('Only managers can add internal notes.')
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
  })
})
