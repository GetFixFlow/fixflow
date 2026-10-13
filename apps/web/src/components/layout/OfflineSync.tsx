import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOfflineState, useOnlineStatus } from '@/hooks/useOfflineQueue'
import { WO_KEY } from '@/hooks/useWorkOrders'
import { syncQueue } from '@/lib/offlineSync'

const RETRY_MS = 20_000

/** Sends what is waiting and tells the person how it went. */
export function useSyncNow() {
  const qc = useQueryClient()
  return useCallback(async () => {
    const { synced, rejected } = await syncQueue()
    if (synced + rejected === 0) return
    qc.invalidateQueries({ queryKey: WO_KEY })
    if (synced > 0) toast.success(`${synced} change${synced === 1 ? '' : 's'} sent.`)
    if (rejected > 0) {
      toast.error(`${rejected} change${rejected === 1 ? ' was' : 's were'} not accepted. Open the sync status at the top to see why.`)
    }
  }, [qc])
}

/** Sends what was done offline: when the device reconnects, when the app opens, and every so often while changes wait. */
export function OfflineSync() {
  const syncNow = useSyncNow()
  const online = useOnlineStatus()
  const waiting = useOfflineState().queue.length > 0

  // The `online` event is not always sent, and a connection can be too weak to get through at first,
  // so keep trying on a timer while anything waits.
  useEffect(() => {
    if (!online || !waiting) return
    syncNow()
    const timer = setInterval(syncNow, RETRY_MS)
    const onVisible = () => document.visibilityState === 'visible' && syncNow()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [online, waiting, syncNow])

  return null
}
