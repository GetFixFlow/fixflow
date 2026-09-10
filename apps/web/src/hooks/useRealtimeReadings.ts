// Manages real-time sensor data for a specific asset.
// Combines initial API fetch + ActionCable live updates.
// Maintains rolling buffer: max 200 readings per metric.

import { useState, useEffect, useRef } from 'react'
import { iotApi } from '@/api'
import { cable } from '@/lib/cable'
import { useAuthStore } from '@/stores/authStore'
import type { SensorReading } from '@/types'

const BUFFER_SIZE = 200
const STALE_MS = 5 * 60 * 1000 // 5 minutes

export interface UseRealtimeReadingsReturn {
  readings: Record<string, SensorReading[]>
  latest: Record<string, SensorReading | null>
  isBreached: Record<string, boolean>
  isStale: Record<string, boolean>
  isConnected: boolean
  isLoading: boolean
}

export function useRealtimeReadings(
  assetId: number | undefined,
  thresholds?: Record<string, { value: number; operator: string }>,
): UseRealtimeReadingsReturn {
  const { isAuthenticated } = useAuthStore()
  const [readings, setReadings] = useState<Record<string, SensorReading[]>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const thresholdsRef = useRef(thresholds)
  useEffect(() => { thresholdsRef.current = thresholds }, [thresholds])

  // Initial fetch
  useEffect(() => {
    if (!assetId) { setIsLoading(false); return }
    setIsLoading(true)
    iotApi.readings.list(assetId, { per_page: 100 }).then((r) => {
      const byMetric: Record<string, SensorReading[]> = {}
      for (const reading of r.data.sensor_readings ?? []) {
        const key = reading.sensor_type
        if (!byMetric[key]) byMetric[key] = []
        byMetric[key].push(reading)
      }
      setReadings(byMetric)
    }).finally(() => setIsLoading(false))
  }, [assetId])

  // ActionCable subscription
  useEffect(() => {
    if (!assetId || !isAuthenticated) return
    const sub = cable.subscriptions.create(
      { channel: 'AssetSensorChannel', asset_id: assetId },
      {
        connected() { setIsConnected(true) },
        disconnected() { setIsConnected(false) },
        received(data: { reading: SensorReading }) {
          if (!data.reading) return
          const r = data.reading
          setReadings((prev) => {
            const key = r.sensor_type
            const existing = prev[key] ?? []
            const next = [...existing, r].slice(-BUFFER_SIZE)
            return { ...prev, [key]: next }
          })
        },
      },
    )
    return () => sub.unsubscribe()
  }, [assetId, isAuthenticated])

  const now = Date.now()

  // Derived: latest reading per metric
  const latest: Record<string, SensorReading | null> = {}
  const isBreached: Record<string, boolean> = {}
  const isStale: Record<string, boolean> = {}

  for (const [metric, list] of Object.entries(readings)) {
    const last = list.at(-1) ?? null
    latest[metric] = last
    isStale[metric] = !last || now - new Date(last.recorded_at).getTime() > STALE_MS
    const threshold = thresholdsRef.current?.[metric]
    if (last && threshold) {
      const v = last.value
      const t = threshold.value
      switch (threshold.operator) {
        case 'gt': isBreached[metric] = v > t; break
        case 'gte': isBreached[metric] = v >= t; break
        case 'lt': isBreached[metric] = v < t; break
        case 'lte': isBreached[metric] = v <= t; break
        case 'eq': isBreached[metric] = v === t; break
        default: isBreached[metric] = false
      }
    } else {
      isBreached[metric] = false
    }
  }

  return { readings, latest, isBreached, isStale, isConnected, isLoading }
}
