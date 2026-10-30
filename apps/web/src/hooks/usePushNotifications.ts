import { useCallback, useEffect, useState } from 'react'
import { pushApi } from '@/api/push'

export type PushSupport =
  /** This browser has no push at all (an iPhone browser tab: add FixFlow to the Home Screen first). */
  | 'unsupported'
  /** Push works only on an https:// address (or localhost). */
  | 'insecure'
  | 'supported'

export type PushPermission = 'default' | 'granted' | 'denied'

function support(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    return 'unsupported'
  }
  return window.isSecureContext ? 'supported' : 'insecure'
}

/** The server's key is urlsafe base64; the browser wants the bytes. */
export function keyToBytes(key: string): Uint8Array {
  const padded = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

/**
 * Push notifications on THIS device (Web Push): whether it can, whether it is on, turning it on and off, and a test.
 * The server keeps one row for each device; the browser's own subscription is how this device finds its row.
 */
export function usePushNotifications() {
  const [supported] = useState(support)
  const [permission, setPermission] = useState<PushPermission>(
    typeof Notification !== 'undefined' ? (Notification.permission as PushPermission) : 'default',
  )
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(supported === 'supported')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (supported !== 'supported') return
    try {
      const [subscription, { data }] = await Promise.all([currentSubscription(), pushApi.list()])
      // On only if the browser has a subscription AND the server knows it (a subscription the server dropped is not on).
      setEnabled(!!subscription && data.subscriptions.some((d) => d.endpoint === subscription.endpoint))
    } catch {
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [supported])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enable = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const result = await Notification.requestPermission()
      setPermission(result as PushPermission)
      if (result !== 'granted') {
        setError(result === 'denied' ? 'Notifications are blocked for this site in the browser. Allow them in the browser settings, then try again.' : 'Permission was not given.')
        return false
      }
      const { data } = await pushApi.list()
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      // A subscription made under another server key (a changed SECRET_KEY_BASE) is no use: start again.
      if (subscription) {
        const keyUsed = subscription.options?.applicationServerKey
        const wanted = keyToBytes(data.public_key)
        const same = keyUsed && new Uint8Array(keyUsed).length === wanted.length && new Uint8Array(keyUsed).every((b, i) => b === wanted[i])
        if (!same) {
          await subscription.unsubscribe()
          subscription = null
        }
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.public_key) as BufferSource })
      const json = subscription.toJSON()
      await pushApi.subscribe({ endpoint: subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } })
      setEnabled(true)
      return true
    } catch (e) {
      setError(messageFor(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const subscription = await currentSubscription()
      if (subscription) {
        await pushApi.unsubscribe(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setEnabled(false)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }, [])

  /** => a sentence about what happened, for the person. */
  const sendTest = useCallback(async (): Promise<string> => {
    setBusy(true)
    setError(null)
    try {
      const { data } = await pushApi.test()
      if (data.sent > 0) return 'Sent. It should appear on your devices in a moment.'
      if (data.removed > 0) {
        setEnabled(false)
        return 'The browser had cancelled it, so it was removed. Turn notifications on again.'
      }
      return 'The push service did not accept it. Try again in a minute.'
    } catch (e) {
      setError(messageFor(e))
      return ''
    } finally {
      setBusy(false)
    }
  }, [])

  return { supported, permission, enabled, loading, busy, error, enable, disable, sendTest }
}

function messageFor(e: unknown): string {
  const response = (e as { response?: { data?: { error?: { message?: string } } } }).response
  if (response?.data?.error?.message) return response.data.error.message
  return e instanceof Error && e.message ? e.message : 'Something went wrong. Try again.'
}
