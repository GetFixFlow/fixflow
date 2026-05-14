import { useEffect } from 'react'
import { cable } from '@/lib/cable'
import { useRealtimeStore } from '@/stores/realtimeStore'
import { useAuthStore } from '@/stores/authStore'
import type { SensorReading, IotAlert } from '@/types'

export function useSensorChannel() {
  const { isAuthenticated } = useAuthStore()
  const { addReading, addAlert, setConnected } = useRealtimeStore()

  useEffect(() => {
    if (!isAuthenticated) return

    const subscription = cable.subscriptions.create('SensorChannel', {
      connected() { setConnected(true) },
      disconnected() { setConnected(false) },
      received(data: { type: string; reading?: SensorReading; alert?: IotAlert }) {
        if (data.type === 'reading' && data.reading) {
          addReading(data.reading)
        } else if (data.type === 'alert' && data.alert) {
          addAlert(data.alert)
        }
      },
    })

    return () => subscription.unsubscribe()
  }, [isAuthenticated, addReading, addAlert, setConnected])
}
