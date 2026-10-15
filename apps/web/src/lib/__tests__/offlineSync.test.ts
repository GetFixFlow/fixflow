import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { offlineQueue } from '../offlineQueue'
import { syncQueue } from '../offlineSync'
import { fileStore } from '../fileStore'
import { apiClient } from '@/api/client'
import { resetDevice, setOnline, signInAs } from '@/test/offline'

beforeEach(() => {
  resetDevice()
  signInAs(1)
})

const transition = (workOrderId: number, event: 'start' | 'complete' = 'start') =>
  offlineQueue.enqueue({ type: 'transition', workOrderId, event, payload: event === 'complete' ? { work_order: { completion_notes: 'Done properly' } } : undefined, label: `${event} on WO-${workOrderId}` })
const comment = (workOrderId: number, body = 'Belt replaced', clientId = 'c1') =>
  offlineQueue.enqueue({ type: 'comment', workOrderId, body, internal: false, clientId, label: `Comment on WO-${workOrderId}` })

const ok = (data: object = {}) => HttpResponse.json({ data })
const refuse = (status: number, message: string) => HttpResponse.json({ success: false, error: { code: 'X', message } }, { status })

describe('syncQueue', () => {
  it('sends everything in the order it was made, then empties the queue', async () => {
    const sent: string[] = []
    server.use(
      http.patch('/api/v1/work_orders/:id/transition', async ({ request, params }) => {
        sent.push(`${(await request.json() as { event: string }).event} ${params.id}`)
        return ok()
      }),
      http.post('/api/v1/work_orders/:id/comments', async ({ request, params }) => {
        const { comment } = (await request.json()) as { comment: { body: string; client_id: string; internal: boolean } }
        sent.push(`comment ${params.id} ${comment.body} ${comment.client_id} ${comment.internal}`)
        return ok()
      }),
    )
    transition(1, 'start')
    comment(1, 'Belt replaced', 'abc')
    transition(1, 'complete')

    const result = await syncQueue()

    expect(sent).toEqual(['start 1', 'comment 1 Belt replaced abc false', 'complete 1'])
    expect(result).toEqual({ synced: 3, rejected: 0 })
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
  })

  it('sends nothing while offline', async () => {
    const hit = vi.fn()
    server.use(http.patch('/api/v1/work_orders/:id/transition', () => { hit(); return ok() }))
    transition(1)
    setOnline(false)

    expect(await syncQueue()).toEqual({ synced: 0, rejected: 0 })
    expect(hit).not.toHaveBeenCalled()
    expect(offlineQueue.getSnapshot().queue).toHaveLength(1)
  })

  it('stops at the first connection failure and keeps the rest in order', async () => {
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () => ok()),
      http.patch('/api/v1/work_orders/2/transition', () => HttpResponse.error()),
      http.patch('/api/v1/work_orders/3/transition', () => ok()),
    )
    transition(1)
    transition(2)
    transition(3)

    const result = await syncQueue()

    expect(result).toEqual({ synced: 1, rejected: 0 })
    expect(offlineQueue.getSnapshot().queue.map((a) => a.workOrderId)).toEqual([2, 3])
  })

  it.each([500, 503, 429, 401])('keeps the change when the server answers %i, to try again later', async (status) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined) // jsdom cannot follow the redirect to /login a 401 triggers
    server.use(http.patch('/api/v1/work_orders/1/transition', () => refuse(status, 'later')))
    transition(1)

    expect(await syncQueue()).toEqual({ synced: 0, rejected: 0 })
    expect(offlineQueue.getSnapshot().queue).toHaveLength(1)
    expect(offlineQueue.getSnapshot().rejected).toHaveLength(0)
  })

  it('gives up on a change the server refuses, tells why, and carries on with the rest', async () => {
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () => refuse(403, 'You are not assigned to this work order.')),
      http.get('/api/v1/work_orders/1', () => ok({ id: 1, status: 'assigned' })),
      http.post('/api/v1/work_orders/2/comments', () => ok()),
    )
    transition(1)
    comment(2)

    const result = await syncQueue()

    expect(result).toEqual({ synced: 1, rejected: 1 })
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
    expect(offlineQueue.getSnapshot().rejected[0]).toMatchObject({ message: 'You are not assigned to this work order.' })
  })

  it('counts a refused status change as sent when the work order is already where it was going', async () => {
    // The first try reached the server but the reply was lost; the retry is refused as "already started".
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () => refuse(422, 'Cannot start from in_progress')),
      http.get('/api/v1/work_orders/1', () => ok({ id: 1, status: 'in_progress' })),
    )
    transition(1, 'start')

    expect(await syncQueue()).toEqual({ synced: 1, rejected: 0 })
    expect(offlineQueue.getSnapshot().rejected).toHaveLength(0)
  })

  it('does not take a refusal for success when the work order is somewhere else', async () => {
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () => refuse(422, 'Cannot start from completed')),
      http.get('/api/v1/work_orders/1', () => ok({ id: 1, status: 'completed' })),
    )
    transition(1, 'start')

    expect(await syncQueue()).toEqual({ synced: 0, rejected: 1 })
  })

  it('does not send anything twice when asked again while a send is under way', async () => {
    let calls = 0
    server.use(http.patch('/api/v1/work_orders/1/transition', () => { calls++; return ok() }))
    transition(1)

    const [first, second] = await Promise.all([syncQueue(), syncQueue()])

    expect(calls).toBe(1)
    expect(first).toEqual({ synced: 1, rejected: 0 })
    expect(second).toEqual({ synced: 0, rejected: 0 }) // not reported twice
  })
})

describe('syncQueue: photos', () => {
  const keepPhoto = async (workOrderId = 1, clientId = 'p1') => {
    const fileKey = `photo-${clientId}`
    await fileStore.put(fileKey, new Blob([new Uint8Array(500)], { type: 'image/jpeg' }))
    return offlineQueue.enqueue({ type: 'photo', workOrderId, fileKey, filename: 'leak.jpg', contentType: 'image/jpeg', size: 500, clientId, label: 'Photo "leak.jpg"' })
  }

  it('uploads the kept file with its name and id, then forgets it', async () => {
    server.use(http.post('/api/v1/work_orders/1/attachments', () => ok()))
    const post = vi.spyOn(apiClient, 'post')
    await keepPhoto()

    expect(await syncQueue()).toEqual({ synced: 1, rejected: 0 })

    const form = post.mock.calls[0][1] as FormData
    const file = form?.get('attachment[file]') as File
    expect(file.name).toBe('leak.jpg')
    expect(file.type).toBe('image/jpeg')
    expect(file.size).toBe(500)
    expect(form?.get('client_id')).toBe('p1')
    expect(await fileStore.get('photo-p1')).toBeUndefined()
  })

  it('keeps the file for the next try when there is no connection', async () => {
    server.use(http.post('/api/v1/work_orders/1/attachments', () => HttpResponse.error()))
    await keepPhoto()

    expect(await syncQueue()).toEqual({ synced: 0, rejected: 0 })

    expect(offlineQueue.getSnapshot().queue).toHaveLength(1)
    expect(await fileStore.get('photo-p1')).toBeDefined()
  })

  it('gives up with the reason when the server refuses it, and frees the file', async () => {
    server.use(http.post('/api/v1/work_orders/1/attachments', () => refuse(422, 'That file is not a valid photo.')))
    await keepPhoto()

    expect(await syncQueue()).toEqual({ synced: 0, rejected: 1 })

    expect(offlineQueue.getSnapshot().rejected[0]).toMatchObject({ message: 'That file is not a valid photo.' })
    expect(await fileStore.get('photo-p1')).toBeUndefined()
  })

  it('says so when the file is gone from the device, and carries on', async () => {
    server.use(http.post('/api/v1/work_orders/2/comments', () => ok()))
    const photo = await keepPhoto()
    await fileStore.delete(photo.type === 'photo' ? photo.fileKey : '')
    comment(2)

    expect(await syncQueue()).toEqual({ synced: 1, rejected: 1 })
    expect(offlineQueue.getSnapshot().rejected[0]).toMatchObject({ message: 'The photo is no longer on this device.' })
  })
})

describe('syncQueue: checklist steps', () => {
  const tick = (step: number, completed = true) =>
    offlineQueue.enqueue({ type: 'checklist', workOrderId: 1, step, completed, label: `Checklist step ${step} on WO-000001` })

  it('sends each tick as just that step, in the order they were made', async () => {
    const sent: unknown[] = []
    server.use(http.patch('/api/v1/work_orders/1', () => ok()))
    const patch = vi.spyOn(apiClient, 'patch')
    tick(2)
    tick(1)
    tick(2, false)

    expect(await syncQueue()).toEqual({ synced: 3, rejected: 0 })

    patch.mock.calls.forEach((call) => sent.push((call[1] as { work_order: { checklist: unknown } }).work_order.checklist))
    expect(sent).toEqual([[{ step: 2, completed: true }], [{ step: 1, completed: true }], [{ step: 2, completed: false }]])
  })

  it('keeps ticks for the next try when there is no connection', async () => {
    server.use(http.patch('/api/v1/work_orders/1', () => HttpResponse.error()))
    tick(1)

    expect(await syncQueue()).toEqual({ synced: 0, rejected: 0 })
    expect(offlineQueue.getSnapshot().queue).toHaveLength(1)
  })

  it('tells the person when the work order was completed meanwhile, so the tick was not kept', async () => {
    server.use(http.patch('/api/v1/work_orders/1', () =>
      refuse(422, 'This work order is completed, so its checklist can no longer be changed.')))
    tick(1)

    expect(await syncQueue()).toEqual({ synced: 0, rejected: 1 })
    expect(offlineQueue.getSnapshot().rejected[0]).toMatchObject({
      message: 'This work order is completed, so its checklist can no longer be changed.',
      action: { label: 'Checklist step 1 on WO-000001' },
    })
  })
})
