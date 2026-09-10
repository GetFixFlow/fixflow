import { useState, useCallback } from 'react'

type PermissionStatus = 'default' | 'granted' | 'denied'

export function usePushNotifications() {
  const [permission, setPermission] = useState<PermissionStatus>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') return false

    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }, [])

  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (permission !== 'granted') return
      try {
        // Use service worker notification if available, else direct
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, options)
          })
        } else {
          new Notification(title, options)
        }
      } catch {
        // Notifications may not be supported
      }
    },
    [permission],
  )

  return { permission, requestPermission, showNotification }
}
