import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOfflineQueue } from '../useOfflineQueue'

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('useOfflineQueue', () => {
  beforeEach(() => {
    localStorageMock.clear()
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })
  })

  it('queues actions when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
    const processor = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useOfflineQueue(processor))
    expect(result.current.isOnline).toBe(false)

    act(() => {
      result.current.enqueue('transition', { id: 1, event: 'start' })
    })

    expect(result.current.queueLength).toBe(1)
  })

  it('queue persists in localStorage', () => {
    const processor = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useOfflineQueue(processor))

    act(() => {
      result.current.enqueue('comment', { work_order_id: 1, body: 'Test' })
    })

    const stored = JSON.parse(localStorageMock.getItem('fixflow-offline-queue') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].type).toBe('comment')
  })

  it('processes queue on reconnect', async () => {
    const processor = vi.fn().mockResolvedValue(undefined)

    // Start offline, add to queue
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false })
    const { result, rerender } = renderHook(() => useOfflineQueue(processor))

    act(() => {
      result.current.enqueue('transition', { id: 1, event: 'complete' })
    })
    expect(result.current.queueLength).toBe(1)

    // Go online — the processQueue should fire
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true })
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    rerender()

    // Allow async processing
    await act(async () => {
      await result.current.processQueue()
    })
    expect(processor).toHaveBeenCalled()
  })

  it('handles conflicts gracefully (processor throws)', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('Conflict'))
    const { result } = renderHook(() => useOfflineQueue(processor))

    act(() => {
      result.current.enqueue('transition', { id: 1, event: 'start' })
    })

    await act(async () => {
      await result.current.processQueue()
    })

    // Failed items remain in queue
    expect(result.current.queueLength).toBe(1)
  })
})
