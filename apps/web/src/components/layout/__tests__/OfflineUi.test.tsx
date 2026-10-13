import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { resetDevice, setOnline, signInAs } from '@/test/offline'
import { offlineQueue } from '@/lib/offlineQueue'
import { OfflineSync } from '../OfflineSync'
import { SyncStatus } from '../SyncStatus'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

function renderUi() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OfflineSync />
      <SyncStatus />
    </QueryClientProvider>,
  )
}

const queueStart = () => offlineQueue.enqueue({ type: 'transition', workOrderId: 1, event: 'start', label: 'Start work on WO-000001' })

beforeEach(() => {
  vi.clearAllMocks()
  resetDevice()
  signInAs(7)
})

describe('SyncStatus', () => {
  it('shows nothing when online with nothing waiting', () => {
    renderUi()
    expect(screen.queryByLabelText('Sync status')).not.toBeInTheDocument()
  })

  it('says it is offline, and what is waiting', async () => {
    setOnline(false)
    queueStart()
    renderUi()

    await userEvent.click(screen.getByLabelText('Sync status'))

    expect(screen.getByLabelText('Sync status')).toHaveTextContent('Offline · 1 waiting')
    expect(screen.getByText(/saved on this device/i)).toBeInTheDocument()
    expect(screen.getByText('Start work on WO-000001')).toBeInTheDocument()
  })

  it('shows what the server refused and why, until dismissed', async () => {
    const queued = queueStart()
    offlineQueue.reject(queued.id, 'You are not assigned to this work order.')
    renderUi()

    expect(screen.getByLabelText('Sync status')).toHaveTextContent('1 not saved')
    await userEvent.click(screen.getByLabelText('Sync status'))
    expect(screen.getByText('You are not assigned to this work order.')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Dismiss'))
    expect(screen.queryByLabelText('Sync status')).not.toBeInTheDocument()
  })
})

describe('OfflineSync', () => {
  it('sends the waiting changes when the connection comes back, and tells the person', async () => {
    const sent = vi.fn()
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () => { sent(); return HttpResponse.json({ data: {} }) }),
      http.get('/api/v1/work_orders', () => HttpResponse.json({ work_orders: [], meta: {} })),
    )
    setOnline(false)
    queueStart()
    renderUi()
    expect(sent).not.toHaveBeenCalled()

    await act(async () => {
      setOnline(true)
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('1 change sent.'))
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
  })

  it('sends what was left from last time as soon as the app opens online', async () => {
    const sent = vi.fn()
    server.use(
      http.post('/api/v1/work_orders/1/comments', () => { sent(); return HttpResponse.json({ data: {} }, { status: 201 }) }),
      http.get('/api/v1/work_orders', () => HttpResponse.json({ work_orders: [], meta: {} })),
    )
    offlineQueue.enqueue({ type: 'comment', workOrderId: 1, body: 'Belt replaced', internal: false, clientId: 'c1', label: 'Comment' })

    renderUi()

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1))
  })

  it('warns when the server refused something', async () => {
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () => HttpResponse.json({ error: { message: 'no' } }, { status: 403 })),
      http.get('/api/v1/work_orders/1', () => HttpResponse.json({ data: { status: 'assigned' } })),
      http.get('/api/v1/work_orders', () => HttpResponse.json({ work_orders: [], meta: {} })),
    )
    queueStart()
    renderUi()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('not accepted')))
  })
})
