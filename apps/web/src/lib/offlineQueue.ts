import { useAuthStore } from '@/stores/authStore'
import type { WorkOrder, WorkOrderStatus } from '@/types'

/**
 * Changes made without a connection, kept on this device until they can be sent, in order.
 * The queue belongs to the person who made the changes: it is stored under their id, and
 * another person signing in on the same phone neither sees nor sends it.
 */

/** The work order events a technician can fire in the field. The rest need the server's say-so. */
export const OFFLINE_EVENTS = ['start', 'hold', 'pending_parts', 'need_parts', 'resume', 'complete'] as const
export type OfflineEvent = (typeof OFFLINE_EVENTS)[number]

/** The status each event leads to, used to show the change straight away and to spot one already applied. */
export const EVENT_RESULT_STATUS: Record<OfflineEvent, WorkOrderStatus> = {
  start: 'in_progress',
  hold: 'on_hold',
  pending_parts: 'pending_parts',
  need_parts: 'pending_parts',
  resume: 'in_progress',
  complete: 'completed',
}

export const isOfflineEvent = (event: string): event is OfflineEvent => (OFFLINE_EVENTS as readonly string[]).includes(event)

interface Base {
  id: string
  workOrderId: number
  /** What it is, in words, for messages ("Start work on WO-000012"). */
  label: string
  queuedAt: number
}
export interface QueuedTransition extends Base {
  type: 'transition'
  event: OfflineEvent
  payload?: Record<string, unknown>
}
export interface QueuedComment extends Base {
  type: 'comment'
  body: string
  internal: boolean
  /** Sent with the comment so sending it twice (a reply lost on a bad connection) posts it once. */
  clientId: string
}
export interface QueuedPhoto extends Base {
  type: 'photo'
  /** Where the file is kept on the device (see fileStore). */
  fileKey: string
  filename: string
  contentType: string
  size: number
  clientId: string
}
export interface QueuedChecklistStep extends Base {
  type: 'checklist'
  step: number
  completed: boolean
}
export type QueuedAction = QueuedTransition | QueuedComment | QueuedPhoto | QueuedChecklistStep

export interface RejectedAction {
  action: QueuedAction
  message: string
  at: number
}

export interface OfflineState {
  queue: QueuedAction[]
  rejected: RejectedAction[]
}

const EMPTY: OfflineState = { queue: [], rejected: [] }
const keyFor = (userId: number) => `fixflow-offline:${userId}`

let state: OfflineState = EMPTY
let loadedKey: string | null = null
const listeners = new Set<() => void>()

const currentKey = () => {
  const id = useAuthStore.getState().user?.id
  return id == null ? null : keyFor(id)
}

function read(key: string): OfflineState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
    return { queue: parsed?.queue ?? [], rejected: parsed?.rejected ?? [] }
  } catch {
    return EMPTY
  }
}

/** The signed-in person's queue, loaded the first time and again when someone else signs in. */
function current(): OfflineState {
  const key = currentKey()
  if (key !== loadedKey) {
    loadedKey = key
    state = key ? read(key) : EMPTY
  }
  return state
}

function commit(next: OfflineState) {
  state = next
  const key = currentKey()
  if (key) {
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Storage full or blocked: the queue still works until the page is closed.
    }
  }
  listeners.forEach((l) => l())
}

// Tell the screens when someone signs in or out, as that swaps the queue they should see.
useAuthStore.subscribe(() => listeners.forEach((l) => l()))

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

/** A random id that also works on a plain-HTTP network address, where crypto.randomUUID is missing. */
export const newClientId = () => globalThis.crypto?.randomUUID?.() ?? `c-${newId()}${Math.random().toString(36).slice(2, 10)}`

export const offlineQueue = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: current,

  /** False when nobody is signed in, as there is no one to keep the change for. */
  canQueue: () => currentKey() !== null,

  enqueue(action: Omit<QueuedTransition, 'id' | 'queuedAt'> | Omit<QueuedComment, 'id' | 'queuedAt'> | Omit<QueuedPhoto, 'id' | 'queuedAt'> | Omit<QueuedChecklistStep, 'id' | 'queuedAt'>) {
    const queued = { ...action, id: newId(), queuedAt: Date.now() } as QueuedAction
    commit({ ...current(), queue: [...current().queue, queued] })
    return queued
  },

  /** Sent, or found to be applied already. */
  remove(id: string) {
    commit({ ...current(), queue: current().queue.filter((a) => a.id !== id) })
  },

  /** The server refused it. It stays visible until the person has seen it. */
  reject(id: string, message: string) {
    const s = current()
    const action = s.queue.find((a) => a.id === id)
    if (!action) return
    commit({ queue: s.queue.filter((a) => a.id !== id), rejected: [...s.rejected, { action, message, at: Date.now() }] })
  },

  dismissRejected(id: string) {
    commit({ ...current(), rejected: current().rejected.filter((r) => r.action.id !== id) })
  },
}

/** The work order as the person left it: its status and checklist moved on by the changes still waiting to be sent. */
export function applyPending(workOrder: WorkOrder, actions: QueuedAction[]): WorkOrder {
  const mine = actions.filter((a) => a.workOrderId === workOrder.id)
  const transitions = mine.filter((a): a is QueuedTransition => a.type === 'transition')
  const steps = mine.filter((a): a is QueuedChecklistStep => a.type === 'checklist')
  if (transitions.length === 0 && steps.length === 0) return workOrder

  const result: WorkOrder = { ...workOrder, pending_sync: transitions.length + steps.length }
  if (transitions.length > 0) result.status = EVENT_RESULT_STATUS[transitions[transitions.length - 1].event]
  if (steps.length > 0 && workOrder.checklist) {
    result.checklist = workOrder.checklist.map((item) => {
      const latest = [...steps].reverse().find((s) => s.step === item.step)
      return latest ? { ...item, completed: latest.completed, pending: true } : item
    })
  }
  return result
}
