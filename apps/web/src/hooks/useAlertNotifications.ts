// Live alerts for the signed-in person's company (the server's IotAlertChannel). Shows a toast for a serious alert,
// plays a sound for a critical one, refreshes the alert lists and the IoT dashboard, and keeps the header's
// "new alerts" mark and the dashboard's Live / Offline light up to date. Mounted once, in the app layout.

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cable } from '@/lib/cable'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeStore } from '@/stores/realtimeStore'
import type { IotAlertExtended } from '@/types'

const SHOWN_KEY = 'fixflow-shown-alert-ids'

function getShown(): Set<number> {
  try { return new Set(JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? '[]') as number[]) }
  catch { return new Set() }
}

function markShown(id: number) {
  try {
    const s = getShown(); s.add(id)
    sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...s].slice(-200)))
  } catch { /* storage unavailable: an alert may show twice */ }
}

function getSoundEnabled() {
  try { return localStorage.getItem('fixflow-alert-sound') !== 'false' }
  catch { return true }
}

function playAlertTone() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880; gain.gain.value = 0.1
    osc.start(); osc.stop(ctx.currentTime + 0.15)
  } catch { /* audio not supported */ }
}

export function useAlertNotifications() {
  const { isAuthenticated } = useAuthStore()
  const addAlert = useRealtimeStore((s) => s.addAlert)
  const setConnected = useRealtimeStore((s) => s.setConnected)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isAuthenticated) return
    const sub = cable.subscriptions.create('IotAlertChannel', {
      connected() { setConnected(true) },
      disconnected() { setConnected(false) },
      received(data: { alert?: IotAlertExtended }) {
        const alert = data.alert
        if (!alert) return
        // Whoever is looking at a list or the dashboard sees the new alert without reloading.
        queryClient.invalidateQueries({ queryKey: ['iot_alerts'] })
        queryClient.invalidateQueries({ queryKey: ['iot_dashboard'] })
        if (getShown().has(alert.id)) return
        markShown(alert.id)
        addAlert(alert)
        const viewAlerts = { label: 'View', onClick: () => { window.location.href = '/iot/alerts' } }
        if (alert.severity === 'critical') {
          if (getSoundEnabled()) playAlertTone()
          toast.error(`Critical alert: ${alert.message}`, { duration: 10_000, action: viewAlerts })
        } else if (alert.severity === 'high') {
          toast.warning(alert.message, { duration: 5_000, action: viewAlerts })
        }
      },
    })
    return () => {
      sub.unsubscribe()
      setConnected(false)
    }
  }, [isAuthenticated, addAlert, setConnected, queryClient])
}
