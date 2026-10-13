import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import React from 'react'
import { server } from '@/test/server'
import { resetDevice, setOnline, signInAs } from '@/test/offline'
import { offlineQueue, type QueuedPhoto } from '@/lib/offlineQueue'
import { fileStore } from '@/lib/fileStore'
import { apiClient } from '@/api/client'
import { useUploadAttachment } from '../useWorkOrders'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const photo = (name = 'leak.jpg', size = 1000) => new File([new Uint8Array(size)], name, { type: 'image/jpeg' })
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

beforeEach(() => {
  vi.clearAllMocks()
  resetDevice()
  signInAs(7)
})

describe('uploading a photo', () => {
  it('goes straight to the server when online, with an id so a resend is recognised', async () => {
    server.use(http.post('/api/v1/work_orders/1/attachments', () => HttpResponse.json({ data: {} }, { status: 201 })))
    const post = vi.spyOn(apiClient, 'post')
    const { result } = renderHook(() => useUploadAttachment(1), { wrapper })

    await act(async () => { await result.current.mutateAsync(photo()) })

    const form = post.mock.calls[0][1] as FormData
    expect((form.get('attachment[file]') as File).name).toBe('leak.jpg')
    expect(form.get('client_id')).toBeTruthy()
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
  })

  it('is kept on the device, file and all, when there is no connection', async () => {
    setOnline(false)
    const { result } = renderHook(() => useUploadAttachment(1), { wrapper })

    await act(async () => { await result.current.mutateAsync(photo('pump.jpg', 4321)) })

    const [queued] = offlineQueue.getSnapshot().queue as QueuedPhoto[]
    expect(queued).toMatchObject({ type: 'photo', workOrderId: 1, filename: 'pump.jpg', contentType: 'image/jpeg', size: 4321 })
    expect((await fileStore.get(queued.fileKey))?.size).toBe(4321)
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Saved on this device'))
  })

  it('is kept too when the signal drops during the upload', async () => {
    server.use(http.post('/api/v1/work_orders/1/attachments', () => HttpResponse.error()))
    const { result } = renderHook(() => useUploadAttachment(1), { wrapper })

    await act(async () => { await result.current.mutateAsync(photo()) })

    expect(offlineQueue.getSnapshot().queue).toHaveLength(1)
  })

  it('refuses a file over 10 MB, saying which, and keeps nothing', async () => {
    const { result } = renderHook(() => useUploadAttachment(1), { wrapper })

    await act(async () => { await result.current.mutateAsync(new File([new Uint8Array(11 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' })).catch(() => undefined) })

    expect(toast.error).toHaveBeenCalledWith('huge.pdf is over the 10 MB limit.')
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
  })

  it('shows the server\'s reason when it refuses the file', async () => {
    server.use(http.post('/api/v1/work_orders/1/attachments', () =>
      HttpResponse.json({ error: { message: 'That file is not a valid photo.' } }, { status: 422 })))
    const { result } = renderHook(() => useUploadAttachment(1), { wrapper })

    await act(async () => { await result.current.mutateAsync(photo()).catch(() => undefined) })

    expect(toast.error).toHaveBeenCalledWith('That file is not a valid photo.')
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
  })
})
