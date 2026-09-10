import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { useRealtimeReadings } from '../useRealtimeReadings'
import { useAuthStore } from '@/stores/authStore'
import React from 'react'
import type { SensorReading } from '@/types'

const mockReadings: SensorReading[] = [
  { id: 1, asset_id: 1, sensor_type: 'vibration', value: 3.2, unit: 'mm/s', recorded_at: new Date().toISOString() },
  { id: 2, asset_id: 1, sensor_type: 'temperature', value: 72.4, unit: '°C', recorded_at: new Date().toISOString() },
]

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('useRealtimeReadings', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, email: '', full_name: 'Admin', role: 'admin', organization_id: 1, created_at: '' }, token: 'tok', isAuthenticated: true })
    server.use(
      http.get('/api/v1/assets/1/sensor_readings', () =>
        HttpResponse.json({ sensor_readings: mockReadings }),
      ),
    )
  })

  it('loads initial readings from API', async () => {
    const { result } = renderHook(() => useRealtimeReadings(1), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(Object.keys(result.current.readings).length).toBeGreaterThan(0)
  })

  it('latest reading per metric available', async () => {
    const { result } = renderHook(() => useRealtimeReadings(1), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const metrics = Object.keys(result.current.readings)
    expect(metrics.length).toBeGreaterThanOrEqual(1)
  })

  it('isBreached true when value exceeds threshold', async () => {
    server.use(
      http.get('/api/v1/assets/1/sensor_readings', () =>
        HttpResponse.json({ sensor_readings: [{ id: 3, asset_id: 1, sensor_type: 'vibration', value: 9.5, unit: 'mm/s', recorded_at: new Date().toISOString() }] }),
      ),
    )
    const { result } = renderHook(
      () => useRealtimeReadings(1, { vibration: { value: 8.5, operator: 'gt' } }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isBreached['vibration']).toBe(true)
  })

  it('isStale true when reading is old', async () => {
    const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    server.use(
      http.get('/api/v1/assets/1/sensor_readings', () =>
        HttpResponse.json({ sensor_readings: [{ id: 4, asset_id: 1, sensor_type: 'vibration', value: 3.2, unit: 'mm/s', recorded_at: oldDate }] }),
      ),
    )
    const { result } = renderHook(() => useRealtimeReadings(1), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isStale['vibration']).toBe(true)
  })
})
