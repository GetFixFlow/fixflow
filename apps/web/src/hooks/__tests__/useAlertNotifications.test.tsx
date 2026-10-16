import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeStore } from '@/stores/realtimeStore'
import { useAlertNotifications } from '../useAlertNotifications'
import type { IotAlertExtended } from '@/types'

interface FakeSub {
  channel: unknown
  handlers: { connected(): void; disconnected(): void; received(data: unknown): void }
  unsubscribe: ReturnType<typeof vi.fn>
}
const subs = vi.hoisted(() => [] as FakeSub[])
vi.mock('@/lib/cable', () => ({
  cable: {
    subscriptions: {
      create: vi.fn((channel: unknown, handlers: FakeSub['handlers']) => {
        const sub = { channel, handlers, unsubscribe: vi.fn() }
        subs.push(sub)
        return sub
      }),
    },
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }))

const alert = (over: Partial<IotAlertExtended> = {}) =>
  ({ id: 1, severity: 'critical', message: 'temperature above 85 °C (reading 91 °C)', status: 'open', ...over }) as IotAlertExtended

function setup() {
  const qc = new QueryClient()
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  const hook = renderHook(() => useAlertNotifications(), { wrapper })
  return { hook, invalidate, sub: subs[subs.length - 1] }
}

describe('useAlertNotifications', () => {
  beforeEach(() => {
    subs.length = 0
    sessionStorage.clear()
    localStorage.clear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.warning).mockClear()
    useRealtimeStore.setState({ newAlerts: [], connected: false })
    useAuthStore.setState({ isAuthenticated: true })
  })

  it("listens to the company's alert channel the server offers (IotAlertChannel)", () => {
    const { sub } = setup()

    expect(sub.channel).toBe('IotAlertChannel')
  })

  it('does not listen when nobody is signed in', () => {
    useAuthStore.setState({ isAuthenticated: false })

    setup()

    expect(subs).toHaveLength(0)
  })

  it('shows Live once connected, Offline when the connection drops, and Offline on leaving', () => {
    const { hook, sub } = setup()
    expect(useRealtimeStore.getState().connected).toBe(false)

    sub.handlers.connected()
    expect(useRealtimeStore.getState().connected).toBe(true)
    sub.handlers.disconnected()
    expect(useRealtimeStore.getState().connected).toBe(false)

    sub.handlers.connected()
    hook.unmount()
    expect(useRealtimeStore.getState().connected).toBe(false)
    expect(sub.unsubscribe).toHaveBeenCalled()
  })

  it('shows a critical alert as an error toast with its message, and keeps it for the header', () => {
    const { sub } = setup()

    sub.handlers.received({ alert: alert() })

    expect(toast.error).toHaveBeenCalledWith('Critical alert: temperature above 85 °C (reading 91 °C)', expect.objectContaining({ duration: 10_000 }))
    expect(useRealtimeStore.getState().newAlerts.map((a) => a.id)).toEqual([1])
  })

  it('shows a high alert as a warning, and a medium or low one without a toast (they are in the list)', () => {
    const { sub } = setup()

    sub.handlers.received({ alert: alert({ id: 2, severity: 'high', message: 'warm' }) })
    sub.handlers.received({ alert: alert({ id: 3, severity: 'medium' }) })
    sub.handlers.received({ alert: alert({ id: 4, severity: 'low' }) })

    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(toast.warning).toHaveBeenCalledWith('warm', expect.anything())
    expect(toast.error).not.toHaveBeenCalled()
    expect(useRealtimeStore.getState().newAlerts).toHaveLength(3)
  })

  it('refreshes the alert lists and the dashboard, so they show it without a reload', () => {
    const { sub, invalidate } = setup()

    sub.handlers.received({ alert: alert({ severity: 'low' }) })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['iot_alerts'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['iot_dashboard'] })
  })

  it('does not show the same alert twice', () => {
    const { sub } = setup()

    sub.handlers.received({ alert: alert() })
    sub.handlers.received({ alert: alert() })

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(useRealtimeStore.getState().newAlerts).toHaveLength(1)
  })

  it('stays quiet (but still refreshes) when the sound is off: no tone is played', () => {
    localStorage.setItem('fixflow-alert-sound', 'false')
    const audio = vi.fn()
    vi.stubGlobal('AudioContext', audio)
    const { sub } = setup()

    sub.handlers.received({ alert: alert() })

    expect(audio).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('ignores a message that is not an alert', () => {
    const { sub, invalidate } = setup()

    sub.handlers.received({})
    sub.handlers.received({ type: 'sensor_reading' })

    expect(toast.error).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    expect(useRealtimeStore.getState().newAlerts).toHaveLength(0)
  })
})
