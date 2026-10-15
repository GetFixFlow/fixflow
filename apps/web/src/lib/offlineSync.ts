import axios from 'axios'
import { workOrdersApi } from '@/api'
import { fileStore } from './fileStore'
import { EVENT_RESULT_STATUS, offlineQueue, type QueuedAction } from './offlineQueue'

export interface SyncResult {
  synced: number
  rejected: number
}

/** The photo was not found on the device: the browser cleared its storage, or this is another browser. */
class PhotoMissing extends Error {}

const serverMessage = (error: unknown) =>
  (error instanceof PhotoMissing && error.message) ||
  (axios.isAxiosError(error) && error.response?.data?.error?.message) ||
  'The server did not accept it.'

/** A photo that is sent or given up on no longer needs its file kept. */
const forget = (action: QueuedAction) => (action.type === 'photo' ? fileStore.delete(action.fileKey).catch(() => undefined) : undefined)

/** No answer at all: no signal, a timeout, a dropped connection. The change may or may not have arrived. */
export const isNetworkError = (error: unknown) => axios.isAxiosError(error) && !error.response

/** Worth trying again later rather than giving up on the change. */
const isTemporary = (error: unknown) => {
  if (isNetworkError(error)) return true
  const status = axios.isAxiosError(error) ? error.response?.status : undefined
  return status === 401 || status === 408 || status === 429 || (status != null && status >= 500)
}

async function send(action: QueuedAction) {
  if (action.type === 'photo') {
    const blob = await fileStore.get(action.fileKey).catch(() => undefined)
    if (!blob) throw new PhotoMissing('The photo is no longer on this device.')
    await workOrdersApi.uploadAttachment(action.workOrderId, new File([blob], action.filename, { type: action.contentType }), action.clientId)
  } else if (action.type === 'checklist') {
    await workOrdersApi.updateChecklist(action.workOrderId, [{ step: action.step, completed: action.completed }])
  } else if (action.type === 'comment') {
    await workOrdersApi.createComment(action.workOrderId, action.body, action.internal, action.clientId)
  } else {
    await workOrdersApi.transition(action.workOrderId, action.event, action.payload)
  }
}

/** The server said no to a status change. If the work order is already where it was going, it did arrive earlier. */
async function alreadyApplied(action: QueuedAction) {
  if (action.type !== 'transition') return false
  try {
    const { data } = await workOrdersApi.get(action.workOrderId)
    return data.data.status === EVENT_RESULT_STATUS[action.event]
  } catch {
    return false
  }
}

async function run(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, rejected: 0 }

  // One at a time and in order: a comment about a part waits for the "need parts" before it.
  for (;;) {
    const action = offlineQueue.getSnapshot().queue[0]
    if (!action) break
    try {
      await send(action)
      offlineQueue.remove(action.id)
      await forget(action)
      result.synced++
    } catch (error) {
      if (isTemporary(error)) break // keep everything, in order, for the next try
      if (await alreadyApplied(action)) {
        offlineQueue.remove(action.id)
        result.synced++
      } else {
        offlineQueue.reject(action.id, serverMessage(error))
        result.rejected++
      }
      await forget(action)
    }
  }
  return result
}

let inFlight: Promise<SyncResult> | null = null

/**
 * Sends what is waiting. A second call while one is under way joins it, so nothing is sent twice from
 * this tab. Other tabs take turns through the Web Locks API where the browser has it (not on plain
 * http addresses); where it does not, a change sent twice is harmless: comments carry an id and a
 * repeated status change is recognised as already applied.
 */
export function syncQueue(): Promise<SyncResult> {
  const none: SyncResult = { synced: 0, rejected: 0 }
  // The one that started it reports what was sent; a caller that joined has nothing new to report.
  if (inFlight) return inFlight.then(() => none)
  if (!navigator.onLine || offlineQueue.getSnapshot().queue.length === 0) return Promise.resolve(none)

  const attempt = navigator.locks
    ? (navigator.locks.request('fixflow-offline-sync', { ifAvailable: true }, async (lock) => (lock ? run() : none)) as Promise<SyncResult>)
    : run()
  inFlight = attempt.finally(() => {
    inFlight = null
  })
  return inFlight
}
