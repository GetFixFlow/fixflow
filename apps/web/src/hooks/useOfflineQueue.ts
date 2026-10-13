import { useMemo, useSyncExternalStore } from 'react'
import { offlineQueue, type OfflineState, type QueuedAction } from '@/lib/offlineQueue'

/** The changes waiting to be sent and the ones the server refused, for the signed-in person. */
export function useOfflineState(): OfflineState {
  return useSyncExternalStore(offlineQueue.subscribe, offlineQueue.getSnapshot)
}

/** What the device thinks: false only when it knows it has no network. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('online', notify)
      window.addEventListener('offline', notify)
      return () => {
        window.removeEventListener('online', notify)
        window.removeEventListener('offline', notify)
      }
    },
    () => navigator.onLine,
  )
}

/** The waiting changes for one work order, or all of them. */
export function usePendingActions(workOrderId?: number): QueuedAction[] {
  const { queue } = useOfflineState()
  return useMemo(() => (workOrderId == null ? queue : queue.filter((a) => a.workOrderId === workOrderId)), [queue, workOrderId])
}
