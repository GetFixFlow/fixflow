import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { ENDPOINT, SERVER_KEY, installPushBrowser, removePushBrowser } from '@/test/pushBrowser'
import { keyToBytes, usePushNotifications } from '../usePushNotifications'

interface Calls {
  subscribed: Record<string, unknown>[]
  unsubscribed: string[]
  tested: number
}

/** The server's side: its public key, the devices it knows, and a record of what it was told. */
function serve({ devices = [] as string[], testResult = { sent: 1, removed: 0, failed: 0 } } = {}) {
  const calls: Calls = { subscribed: [], unsubscribed: [], tested: 0 }
  server.use(
    http.get('/api/v1/push_subscriptions', () =>
      HttpResponse.json({ public_key: SERVER_KEY, subscriptions: devices.map((endpoint, id) => ({ id, endpoint, device: 'Chrome', created_at: '', last_sent_at: null })) }),
    ),
    http.post('/api/v1/push_subscriptions/test', () => {
      calls.tested += 1
      return HttpResponse.json(testResult)
    }),
    http.post('/api/v1/push_subscriptions', async ({ request }) => {
      calls.subscribed.push(((await request.json()) as { subscription: Record<string, unknown> }).subscription)
      return HttpResponse.json({ subscription: {} }, { status: 201 })
    }),
    http.delete('/api/v1/push_subscriptions', ({ request }) => {
      calls.unsubscribed.push(new URL(request.url).searchParams.get('endpoint') ?? '')
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('usePushNotifications', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => removePushBrowser())

  it('turns the server key into the bytes a browser subscribes with', () => {
    const bytes = keyToBytes(SERVER_KEY)

    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
    expect(bytes[64]).toBe(64)
  })

  it('says a browser with no push cannot, and one on a plain http:// address needs https', async () => {
    installPushBrowser({ supported: false })
    expect(renderHook(() => usePushNotifications()).result.current.supported).toBe('unsupported')

    installPushBrowser({ secure: false })
    expect(renderHook(() => usePushNotifications()).result.current.supported).toBe('insecure')
  })

  it('is off for a browser with no subscription, and on when the browser and the server both have it', async () => {
    installPushBrowser()
    serve()
    const off = renderHook(() => usePushNotifications())
    await waitFor(() => expect(off.result.current.loading).toBe(false))
    expect(off.result.current.enabled).toBe(false)

    installPushBrowser({ subscribedWith: keyToBytes(SERVER_KEY) })
    serve({ devices: [ENDPOINT] })
    const on = renderHook(() => usePushNotifications())
    await waitFor(() => expect(on.result.current.enabled).toBe(true))
  })

  it('is off when the browser still has a subscription the server has forgotten', async () => {
    installPushBrowser({ subscribedWith: keyToBytes(SERVER_KEY) })
    serve({ devices: [] })

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.enabled).toBe(false)
  })

  it('asks permission, subscribes with the server key for visible notifications, and tells the server', async () => {
    const { pushManager, requestPermission } = installPushBrowser()
    const calls = serve()
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let ok = false
    await act(async () => {
      ok = await result.current.enable()
    })

    expect(ok).toBe(true)
    expect(requestPermission).toHaveBeenCalledOnce()
    const options = pushManager.subscribe.mock.calls[0][0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array }
    expect(options.userVisibleOnly).toBe(true)
    expect(Array.from(options.applicationServerKey)).toEqual(Array.from(keyToBytes(SERVER_KEY)))
    expect(calls.subscribed).toEqual([{ endpoint: ENDPOINT, keys: { p256dh: 'BROWSER-KEY', auth: 'BROWSER-AUTH' } }])
    expect(result.current.enabled).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('does not subscribe, and says why, when the person refuses or the browser blocks it', async () => {
    const { pushManager } = installPushBrowser({ answer: 'denied', permission: 'denied' })
    const calls = serve()
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.enable()
    })

    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(calls.subscribed).toEqual([])
    expect(result.current.enabled).toBe(false)
    expect(result.current.permission).toBe('denied')
    expect(result.current.error).toMatch(/blocked/i)
  })

  it('starts again when the browser holds a subscription made under another server key', async () => {
    const { pushManager, state } = installPushBrowser({ subscribedWith: new Uint8Array([4, 9, 9, 9]) })
    const old = state.subscription!
    serve()
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.enable()
    })

    expect(old.unsubscribe).toHaveBeenCalled()
    expect(pushManager.subscribe).toHaveBeenCalledOnce()
    expect(result.current.enabled).toBe(true)
  })

  it('keeps a subscription that already uses the server key instead of making another', async () => {
    const { pushManager } = installPushBrowser({ subscribedWith: keyToBytes(SERVER_KEY) })
    const calls = serve()
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.enable()
    })

    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(calls.subscribed).toHaveLength(1) // the server is told again: it may have lost the row
  })

  it('shows the server\'s reason when it refuses the subscription', async () => {
    installPushBrowser()
    serve()
    server.use(
      http.post('/api/v1/push_subscriptions', () =>
        HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'This account already has 10 devices. Turn one off first.' } }, { status: 422 }),
      ),
    )
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      expect(await result.current.enable()).toBe(false)
    })

    expect(result.current.error).toMatch(/10 devices/)
    expect(result.current.enabled).toBe(false)
  })

  it('turns off: tells the server, and cancels the browser\'s subscription', async () => {
    const { state } = installPushBrowser({ subscribedWith: keyToBytes(SERVER_KEY) })
    const sub = state.subscription!
    const calls = serve({ devices: [ENDPOINT] })
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.enabled).toBe(true))

    await act(async () => {
      await result.current.disable()
    })

    expect(calls.unsubscribed).toEqual([ENDPOINT])
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(result.current.enabled).toBe(false)
  })

  it('sends a test and says in words what happened', async () => {
    installPushBrowser({ subscribedWith: keyToBytes(SERVER_KEY) })
    const calls = serve({ devices: [ENDPOINT] })
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.enabled).toBe(true))

    let said = ''
    await act(async () => {
      said = await result.current.sendTest()
    })
    expect(calls.tested).toBe(1)
    expect(said).toMatch(/sent/i)

    serve({ devices: [ENDPOINT], testResult: { sent: 0, removed: 1, failed: 0 } })
    await act(async () => {
      said = await result.current.sendTest()
    })
    expect(said).toMatch(/cancelled/i)
    expect(result.current.enabled).toBe(false)
  })
})
