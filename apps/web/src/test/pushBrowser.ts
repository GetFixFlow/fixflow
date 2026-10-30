import { vi } from 'vitest'

/** 65 bytes, urlsafe base64: the shape of a server (VAPID) public key. */
export const SERVER_KEY = btoa(String.fromCharCode(...Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : i)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const ENDPOINT = 'https://push.example.test/send/abc'

interface Options {
  /** false: the browser has no push at all. */
  supported?: boolean
  secure?: boolean
  permission?: NotificationPermission
  /** What the permission prompt answers. */
  answer?: NotificationPermission
  /** Already subscribed in the browser, under this server key (or any bytes). */
  subscribedWith?: Uint8Array | null
}

/**
 * Gives jsdom what a browser has for Web Push: a service worker registration with a push manager, Notification and
 * isSecureContext. Returns the pieces a test wants to look at.
 */
export function installPushBrowser({ supported = true, secure = true, permission = 'default', answer = 'granted', subscribedWith = null }: Options = {}) {
  const state: { subscription: ReturnType<typeof makeSubscription> | null } = { subscription: null }

  function makeSubscription(key: Uint8Array | ArrayBuffer) {
    return {
      endpoint: ENDPOINT,
      options: { applicationServerKey: key },
      toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'BROWSER-KEY', auth: 'BROWSER-AUTH' } }),
      unsubscribe: vi.fn(async () => {
        state.subscription = null
        return true
      }),
    }
  }
  if (subscribedWith) state.subscription = makeSubscription(subscribedWith)

  const pushManager = {
    getSubscription: vi.fn(async () => state.subscription),
    subscribe: vi.fn(async (options: { applicationServerKey: Uint8Array }) => {
      state.subscription = makeSubscription(options.applicationServerKey)
      return state.subscription
    }),
  }
  const requestPermission = vi.fn(async () => answer)
  const NotificationMock = Object.assign(function Notification() {}, { permission, requestPermission })

  if (supported) {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } })
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} })
    Object.defineProperty(globalThis, 'Notification', { configurable: true, value: NotificationMock })
  } else {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    Reflect.deleteProperty(window, 'PushManager')
  }
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure })

  return { pushManager, requestPermission, state }
}

export function removePushBrowser() {
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(window, 'PushManager')
  Reflect.deleteProperty(globalThis, 'Notification')
  Reflect.deleteProperty(window, 'isSecureContext')
}
