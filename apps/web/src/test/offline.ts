import { onlineManager } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { offlineQueue } from '@/lib/offlineQueue'
import type { Role } from '@/types'

export function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
  onlineManager.setOnline(online) // as a browser's offline event would, so paused requests behave as in real use
}

export function signInAs(id: number, role: Role = 'technician', fullName = 'Tess Tech') {
  useAuthStore.setState({
    user: { id, email: `u${id}@acme.com`, full_name: fullName, role, organization_id: 1 } as never,
    token: 't',
    isAuthenticated: true,
  })
  offlineQueue.getSnapshot()
}

/** A clean device: nobody signed in, nothing stored, online. */
export function resetDevice() {
  localStorage.clear()
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
  offlineQueue.getSnapshot() // forget whatever the last test left in memory
  setOnline(true)
}
