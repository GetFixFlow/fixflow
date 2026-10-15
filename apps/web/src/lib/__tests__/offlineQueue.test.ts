import { describe, it, expect, beforeEach } from 'vitest'
import { applyPending, offlineQueue, type QueuedAction } from '../offlineQueue'
import { resetDevice, signInAs } from '@/test/offline'
import type { WorkOrder } from '@/types'

const start = (workOrderId = 1, event: 'start' | 'complete' = 'start') => ({ type: 'transition' as const, workOrderId, event, label: 'Start work on WO-1' })
const comment = (workOrderId = 1) => ({ type: 'comment' as const, workOrderId, body: 'Belt replaced', internal: false, clientId: 'c1', label: 'Comment on WO-1' })

beforeEach(() => {
  resetDevice()
  signInAs(1)
})

describe('offline queue', () => {
  it('keeps changes in the order they were made', () => {
    offlineQueue.enqueue(start())
    offlineQueue.enqueue(comment())

    expect(offlineQueue.getSnapshot().queue.map((a) => a.type)).toEqual(['transition', 'comment'])
  })

  it('survives closing and reopening the app', () => {
    offlineQueue.enqueue(comment())

    // A new page load starts with nobody loaded in memory, then reads what was stored.
    useAuthStoreReload()

    expect(offlineQueue.getSnapshot().queue).toHaveLength(1)
    expect(offlineQueue.getSnapshot().queue[0]).toMatchObject({ body: 'Belt replaced' })
  })

  it("keeps each person's changes to themselves on a shared phone", () => {
    offlineQueue.enqueue(comment())

    signInAs(2, 'technician', 'Other Tech')
    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
    offlineQueue.enqueue(start(9))

    signInAs(1)
    expect(offlineQueue.getSnapshot().queue.map((a) => a.type)).toEqual(['comment'])
  })

  it('has nowhere to keep a change when nobody is signed in', () => {
    resetDevice()
    expect(offlineQueue.canQueue()).toBe(false)
  })

  it('moves a refused change to the not-accepted list, with the reason, until dismissed', () => {
    const queued = offlineQueue.enqueue(start())

    offlineQueue.reject(queued.id, 'You are not assigned to this work order.')

    expect(offlineQueue.getSnapshot().queue).toHaveLength(0)
    expect(offlineQueue.getSnapshot().rejected[0]).toMatchObject({ message: 'You are not assigned to this work order.' })
    offlineQueue.dismissRejected(queued.id)
    expect(offlineQueue.getSnapshot().rejected).toHaveLength(0)
  })

  it('tells subscribers when something changes', () => {
    let calls = 0
    const stop = offlineQueue.subscribe(() => calls++)
    offlineQueue.enqueue(start())
    stop()
    offlineQueue.enqueue(start())
    expect(calls).toBe(1)
  })
})

function useAuthStoreReload() {
  // Same person, fresh page: drop the in-memory copy by signing out and in again.
  localStorage.setItem('keep', '1')
  const stored = Object.fromEntries(Object.entries(localStorage))
  resetDevice()
  Object.entries(stored).forEach(([k, v]) => localStorage.setItem(k, v))
  signInAs(1)
}

describe('applyPending', () => {
  const wo = { id: 1, status: 'assigned', work_order_number: 'WO-1' } as WorkOrder
  const queued = (...a: Array<ReturnType<typeof start> | ReturnType<typeof comment>>) => a.map((x, i) => ({ ...x, id: `${i}`, queuedAt: i })) as QueuedAction[]

  it('shows the status the waiting changes lead to, and how many are waiting', () => {
    const result = applyPending(wo, queued(start(), start(1, 'complete')))

    expect(result).toMatchObject({ status: 'completed', pending_sync: 2 })
  })

  it('ignores comments and other work orders', () => {
    expect(applyPending(wo, queued(comment(), start(2)))).toBe(wo)
  })

  describe('checklist steps', () => {
    const tick = (step: number, completed: boolean, id = String(step)) =>
      ({ id, type: 'checklist', workOrderId: 1, step, completed, label: 'x', queuedAt: Number(id) }) as QueuedAction
    const checklist = (): WorkOrder =>
      ({ ...wo, checklist: [{ step: 1, instruction: 'A', completed: false }, { step: 2, instruction: 'B', completed: true }] }) as WorkOrder

    it('shows a waiting tick as done, marked as waiting, and leaves the other steps alone', () => {
      const result = applyPending(checklist(), [tick(1, true)])

      expect(result.checklist).toEqual([
        { step: 1, instruction: 'A', completed: true, pending: true },
        { step: 2, instruction: 'B', completed: true },
      ])
      expect(result.pending_sync).toBe(1)
    })

    it('uses the last thing done to a step: ticked, then unticked', () => {
      const result = applyPending(checklist(), [tick(2, false, '1'), tick(2, true, '2'), tick(2, false, '3')])

      expect(result.checklist?.[1]).toMatchObject({ step: 2, completed: false, pending: true })
      expect(result.pending_sync).toBe(3)
    })

    it('counts ticks together with status changes, and ignores other work orders', () => {
      const other = { ...tick(1, true), workOrderId: 9 } as QueuedAction
      const result = applyPending(checklist(), [tick(1, true), { ...start(1), id: 'a', queuedAt: 5 } as QueuedAction, other])

      expect(result).toMatchObject({ status: 'in_progress', pending_sync: 2 })
      expect(applyPending(checklist(), [other])).toEqual(checklist())
    })
  })
})
