import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { resetDevice, setOnline, signInAs } from '@/test/offline'
import { offlineQueue, type QueuedPhoto } from '@/lib/offlineQueue'
import { fileStore } from '@/lib/fileStore'
import { WorkOrderAttachments } from '../WorkOrderAttachments'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const sent = { id: 5, filename: 'sent.jpg', content_type: 'image/jpeg', url: '/api/v1/storage/blobs/redirect/x/sent.jpg', created_at: '', user: { id: 1, full_name: 'A' } }

function renderIt() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkOrderAttachments workOrderId={1} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetDevice()
  signInAs(7)
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  server.use(http.get('/api/v1/work_orders/1/attachments', () => HttpResponse.json({ attachments: [sent] })))
})

describe('WorkOrderAttachments offline', () => {
  it('shows a photo that has not been sent yet next to the ones that have, marked as waiting', async () => {
    await fileStore.put('photo-a', new Blob(['x'], { type: 'image/jpeg' }))
    offlineQueue.enqueue({ type: 'photo', workOrderId: 1, fileKey: 'photo-a', filename: 'leak.jpg', contentType: 'image/jpeg', size: 1, clientId: 'a', label: 'Photo' })
    renderIt()

    expect(await screen.findByText('sent.jpg')).toBeInTheDocument()
    expect(screen.getByText('leak.jpg')).toBeInTheDocument()
    expect(screen.getByText('Waiting to sync')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByAltText('leak.jpg')).toHaveAttribute('src', 'blob:preview'), { timeout: 5000 })
  })

  it('keeps a photo chosen while offline, and shows it at once', async () => {
    renderIt()
    await screen.findByText('sent.jpg')
    setOnline(false)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File([new Uint8Array(800)], 'pump.jpg', { type: 'image/jpeg' }))

    // Keeping the file goes through the (fake) browser database. While it does, the name shows in an
    // "uploading" row that is then replaced by the waiting tile, so wait for the final state.
    expect(await screen.findByText('Waiting to sync', {}, { timeout: 5000 })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('pump.jpg')).toHaveLength(1))
    const [queued] = offlineQueue.getSnapshot().queue as QueuedPhoto[]
    expect(queued).toMatchObject({ type: 'photo', filename: 'pump.jpg', workOrderId: 1 })
  })

  it('counts waiting photos against the limit of 20', async () => {
    renderIt()
    expect(await screen.findByText(/19 remaining/, {}, { timeout: 5000 })).toBeInTheDocument()

    offlineQueue.enqueue({ type: 'photo', workOrderId: 1, fileKey: 'k', filename: 'one.jpg', contentType: 'image/jpeg', size: 1, clientId: 'z', label: 'Photo' })

    expect(await screen.findByText(/18 remaining/, {}, { timeout: 5000 })).toBeInTheDocument()
  })
})
