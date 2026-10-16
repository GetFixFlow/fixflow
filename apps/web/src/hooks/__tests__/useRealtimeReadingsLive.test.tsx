import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeReadings } from '../useRealtimeReadings'

interface FakeSub { channel: unknown; handlers: { connected(): void; disconnected(): void; received(data: unknown): void }; unsubscribe: ReturnType<typeof vi.fn> }
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

describe('useRealtimeReadings: live readings from the server', () => {
  beforeEach(() => {
    subs.length = 0
    useAuthStore.setState({ isAuthenticated: true })
    server.use(http.get('/api/v1/assets/5/sensor_readings', () => HttpResponse.json({ sensor_readings: [] })))
  })

  it("listens to the asset's stream on the channel the server offers (IotChannel)", async () => {
    const { result } = renderHook(() => useRealtimeReadings(5))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(subs[0].channel).toEqual({ channel: 'IotChannel', asset_id: 5 })
  })

  it('adds a reading the way the server announces it (type, metric, value, unit, recorded_at)', async () => {
    const { result } = renderHook(() => useRealtimeReadings(5))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const at = new Date().toISOString()

    act(() => subs[0].handlers.received({ type: 'sensor_reading', asset_id: 5, metric: 'temperature', value: '72.4', unit: '°C', recorded_at: at }))

    expect(result.current.readings.temperature).toHaveLength(1)
    expect(result.current.latest.temperature).toMatchObject({ asset_id: 5, sensor_type: 'temperature', value: 72.4, unit: '°C', recorded_at: at })
    expect(result.current.isStale.temperature).toBe(false)
  })

  it('works out whether the newest reading is past the limit', async () => {
    const { result } = renderHook(() => useRealtimeReadings(5, { temperature: { value: 85, operator: 'gt' } }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => subs[0].handlers.received({ type: 'sensor_reading', metric: 'temperature', value: 91, recorded_at: new Date().toISOString() }))

    expect(result.current.isBreached.temperature).toBe(true)
  })

  it('ignores announcements that are not readings, or are incomplete', async () => {
    const { result } = renderHook(() => useRealtimeReadings(5))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      subs[0].handlers.received({ type: 'alert', alert_id: 1 })
      subs[0].handlers.received({ type: 'sensor_reading', metric: 'temperature' })
      subs[0].handlers.received({ reading: { sensor_type: 'temperature', value: 1 } })
    })

    expect(result.current.readings).toEqual({})
  })

  it('groups the readings it fetched first by the metric the server names (sensor_type)', async () => {
    server.use(http.get('/api/v1/assets/5/sensor_readings', () => HttpResponse.json({ sensor_readings: [
      { id: 1, asset_id: 5, metric_name: 'vibration', sensor_type: 'vibration', value: 3, unit: 'mm/s', recorded_at: new Date().toISOString() },
      { id: 2, asset_id: 5, metric_name: 'temperature', sensor_type: 'temperature', value: 70, unit: '°C', recorded_at: new Date().toISOString() },
    ] })))

    const { result } = renderHook(() => useRealtimeReadings(5))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(Object.keys(result.current.readings).sort()).toEqual(['temperature', 'vibration'])
  })

  it('stops listening when the page is left', async () => {
    const { result, unmount } = renderHook(() => useRealtimeReadings(5))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    unmount()

    expect(subs[0].unsubscribe).toHaveBeenCalled()
  })
})
