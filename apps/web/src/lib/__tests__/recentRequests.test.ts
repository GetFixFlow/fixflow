import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadRecentRequests, rememberRequest } from '../recentRequests'

const request = (n: number) => ({ token: `token-${n}`, title: `Request ${n}`, created_at: '2026-10-10T08:00:00Z' })

describe('recentRequests', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('keeps the newest first, each link once, and no more than 5', () => {
    for (let n = 1; n <= 7; n++) rememberRequest(request(n))
    rememberRequest(request(5))

    expect(loadRecentRequests().map((r) => r.token)).toEqual(['token-5', 'token-7', 'token-6', 'token-4', 'token-3'])
  })

  it.each([['not json'], ['{"a":1}'], ['[1,"x",null,{"token":1}]']])('ignores damaged storage: %s', (stored) => {
    localStorage.setItem('fixflow_recent_requests', stored)

    expect(loadRecentRequests()).toEqual([])
  })

  it('does not fail when storage is unavailable (private windows)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => rememberRequest(request(1))).not.toThrow()
    expect(loadRecentRequests()).toEqual([])
  })
})
