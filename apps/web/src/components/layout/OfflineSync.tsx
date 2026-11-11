import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { t } from '@/i18n'
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
    if (synced > 0) toast.success(t('shell.sync.sent', { count: synced }))
    if (rejected > 0) {
      toast.error(t('shell.sync.not_accepted', { count: rejected }))
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
