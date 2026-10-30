import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// public/push-sw.js is plain JavaScript that a service worker loads. Run it against a stand-in for the worker's global
// scope, and send it the two events a browser does.
type Handler = (event: unknown) => void

function loadWorker(origin = 'https://fixflow.example.com') {
  const handlers: Record<string, Handler> = {}
  const shown: { title: string; options: Record<string, unknown> }[] = []
  const clients = { matchAll: vi.fn(async () => [] as unknown[]), openWindow: vi.fn(async () => ({})) }
  const self = {
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler
    },
    registration: { showNotification: vi.fn(async (title: string, options: Record<string, unknown>) => void shown.push({ title, options })) },
    location: { origin },
    clients,
  }
  const code = readFileSync(resolve(__dirname, '../../public/push-sw.js'), 'utf8')
  new Function('self', code)(self)
  return { handlers, shown, clients, self }
}

/** An event whose waitUntil promise the test can wait for. */
function eventWith(extra: Record<string, unknown>) {
  const pending: Promise<unknown>[] = []
  return { event: { waitUntil: (p: Promise<unknown>) => pending.push(p), ...extra }, done: () => Promise.all(pending) }
}

describe('public/push-sw.js', () => {
  let worker: ReturnType<typeof loadWorker>

  beforeEach(() => {
    worker = loadWorker()
  })

  it('listens for a push and for a tap on its notification', () => {
    expect(Object.keys(worker.handlers).sort()).toEqual(['notificationclick', 'push'])
  })

  it('shows what the server sent: title, text, and the page to open, under a tag that replaces its predecessor', async () => {
    const { event, done } = eventWith({ data: { json: () => ({ title: 'Assigned to you: WO-000012', body: 'Pump 3 is leaking', url: '/work-orders/12', tag: 'wo_assigned' }) } })

    worker.handlers.push(event)
    await done()

    expect(worker.shown).toEqual([
      expect.objectContaining({
        title: 'Assigned to you: WO-000012',
        options: expect.objectContaining({ body: 'Pump 3 is leaking', tag: 'wo_assigned', data: { url: '/work-orders/12' } }),
      }),
    ])
  })

  it('still shows something for a push with no data or data that is not JSON', async () => {
    const empty = eventWith({ data: null })
    worker.handlers.push(empty.event)
    await empty.done()
    const text = eventWith({ data: { json: () => { throw new SyntaxError('no') }, text: () => 'plain words' } })
    worker.handlers.push(text.event)
    await text.done()

    expect(worker.shown.map((n) => n.title)).toEqual(['FixFlow', 'FixFlow'])
    expect(worker.shown[1].options.body).toBe('plain words')
    expect(worker.shown[0].options.data).toEqual({ url: '/' })
  })

  function tap(url: string | undefined) {
    const close = vi.fn()
    const { event, done } = eventWith({ notification: { close, data: url === undefined ? undefined : { url } } })
    worker.handlers.notificationclick(event)
    return { close, done }
  }

  it('opens the page of the notification in a new window when the app is not open', async () => {
    const { close, done } = tap('/work-orders/12')
    await done()

    expect(close).toHaveBeenCalled()
    expect(worker.clients.openWindow).toHaveBeenCalledWith('https://fixflow.example.com/work-orders/12')
  })

  it('focuses and points the window that is already open, instead of opening another', async () => {
    const open = { url: 'https://fixflow.example.com/dashboard', focus: vi.fn(async () => open), navigate: vi.fn(async () => open) }
    worker.clients.matchAll.mockResolvedValue([open])

    await tap('/work-orders/12').done()

    expect(open.navigate).toHaveBeenCalledWith('https://fixflow.example.com/work-orders/12')
    expect(open.focus).toHaveBeenCalled()
    expect(worker.clients.openWindow).not.toHaveBeenCalled()
  })

  it('never opens an address outside this app, whatever the message says', async () => {
    for (const url of ['https://evil.example.net/phish', '//evil.example.net/x', 'javascript:alert(1)']) {
      worker.clients.openWindow.mockClear()
      await tap(url).done()
      const opened = worker.clients.openWindow.mock.calls[0][0] as string
      expect(opened.startsWith('https://fixflow.example.com')).toBe(true)
    }
  })

  it('opens the front page for a notification with no address', async () => {
    await tap(undefined).done()

    expect(worker.clients.openWindow).toHaveBeenCalledWith('https://fixflow.example.com/')
  })
})
