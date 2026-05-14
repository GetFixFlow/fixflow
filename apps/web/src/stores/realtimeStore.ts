import { create } from 'zustand'
import type { SensorReading, IotAlert } from '@/types'

interface RealtimeState {
  latestReadings: Record<number, SensorReading>
  newAlerts: IotAlert[]
  connected: boolean
  setConnected: (v: boolean) => void
  addReading: (reading: SensorReading) => void
  addAlert: (alert: IotAlert) => void
  clearAlerts: () => void
}

export const useRealtimeStore = create<RealtimeState>()((set) => ({
  latestReadings: {},
  newAlerts: [],
  connected: false,

  setConnected: (v) => set({ connected: v }),

  addReading: (reading) =>
    set((s) => ({
      latestReadings: { ...s.latestReadings, [reading.asset_id]: reading },
    })),

  addAlert: (alert) =>
    set((s) => ({ newAlerts: [alert, ...s.newAlerts].slice(0, 50) })),

  clearAlerts: () => set({ newAlerts: [] }),
}))
