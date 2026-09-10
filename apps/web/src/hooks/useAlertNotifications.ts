// Subscribes to ActionCable IoT alerts channel.
// Shows toast on new alert. Plays sound on critical.
// Tracks shown alert IDs in sessionStorage.
// Updates notification count in realtimeStore.

import { useEffect } from 'react'
import { toast } from 'sonner'
import { cable } from '@/lib/cable'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeStore } from '@/stores/realtimeStore'
import type { IotAlert } from '@/types'

const SHOWN_KEY = 'fixflow-shown-alert-ids'

function getShown(): Set<number> {
  try { return new Set(JSON.parse(sessionStorage.getItem(SHOWN_KEY) ?? '[]') as number[]) }
  catch { return new Set() }
}

function markShown(id: number) {
  const s = getShown(); s.add(id)
  sessionStorage.setItem(SHOWN_KEY, JSON.stringify([...s].slice(-200)))
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

  useEffect(() => {
    if (!isAuthenticated) return
    const sub = cable.subscriptions.create('IoTAlertChannel', {
      received(data: { alert: IotAlert }) {
        if (!data.alert) return
        const alert = data.alert
        addAlert(alert)
        if (getShown().has(alert.id)) return
        markShown(alert.id)
        if (alert.severity === 'critical') {
          if (getSoundEnabled()) playAlertTone()
          toast.error(`🔴 Critical Alert: ${alert.message}`, {
            duration: 10_000,
            action: { label: 'View', onClick: () => { window.location.href = '/iot/alerts' } },
          })
        } else if (alert.severity === 'warning') {
          toast.warning(`⚠️ ${alert.message}`, {
            duration: 5_000,
            action: { label: 'View →', onClick: () => { window.location.href = '/iot/alerts' } },
          })
        }
      },
    })
    return () => sub.unsubscribe()
  }, [isAuthenticated, addAlert])
}
