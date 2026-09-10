import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

interface QueuedAction {
  id: string
  type: string
  payload: Record<string, unknown>
  timestamp: number
}

const QUEUE_KEY = 'fixflow-offline-queue'

function loadQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

type ActionProcessor = (action: QueuedAction) => Promise<void>

export function useOfflineQueue(processAction: ActionProcessor) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queue, setQueue] = useState<QueuedAction[]>(loadQueue)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const enqueue = useCallback((type: string, payload: Record<string, unknown>) => {
    const action: QueuedAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
      timestamp: Date.now(),
    }
    setQueue((prev) => {
      const next = [...prev, action]
      saveQueue(next)
      return next
    })
    toast.info('Action queued — will sync when online.')
    return action.id
  }, [])

  const processQueue = useCallback(async () => {
    const current = loadQueue()
    if (current.length === 0 || isSyncing) return
    setIsSyncing(true)
    const processed: string[] = []
    const failed: QueuedAction[] = []

    for (const action of current) {
      try {
        await processAction(action)
        processed.push(action.id)
      } catch {
        failed.push(action)
      }
    }

    setQueue(failed)
    saveQueue(failed)
    setIsSyncing(false)

    if (processed.length > 0) {
      toast.success(`Synced ${processed.length} queued action${processed.length !== 1 ? 's' : ''}.`)
    }
  }, [isSyncing, processAction])

  // Keep a stable ref so the auto-process effect always calls the latest processQueue
  // without adding processQueue to deps (which would cause an infinite retry loop when
  // the processor fails and isSyncing toggles, recreating processQueue each cycle).
  const processQueueRef = useRef(processQueue)
  useEffect(() => {
    processQueueRef.current = processQueue
  }, [processQueue])

  // Auto-process only when transitioning to online, not on every queue mutation.
  useEffect(() => {
    if (isOnline) {
      const savedQueue = loadQueue()
      if (savedQueue.length > 0) {
        processQueueRef.current()
      }
    }
  }, [isOnline])

  return {
    isOnline,
    queue,
    queueLength: queue.length,
    enqueue,
    processQueue,
    isSyncing,
  }
}
