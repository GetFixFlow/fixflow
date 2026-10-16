import { afterEach, describe, expect, it, vi } from 'vitest'
import { cableUrl } from '../cable'

describe('cableUrl', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("carries the sign-in token, because the server only lets a signed-in person connect and a WebSocket cannot send a header", () => {
    localStorage.setItem('auth_token', 'Bearer abc.def.ghi')

    expect(cableUrl()).toBe(`/cable?token=${encodeURIComponent('Bearer abc.def.ghi')}`)
  })

  it('reads the token each time, so signing in again is picked up on the next connection', () => {
    localStorage.setItem('auth_token', 'first')
    const before = cableUrl()
    localStorage.setItem('auth_token', 'second')

    expect(cableUrl()).not.toBe(before)
    expect(cableUrl()).toContain('second')
  })

  it('encodes a token that has characters with a meaning in an address', () => {
    localStorage.setItem('auth_token', 'a b&c=d')

    expect(cableUrl()).toBe('/cable?token=a%20b%26c%3Dd')
  })

  it('connects without a token when there is none (the server then refuses)', () => {
    expect(cableUrl()).toBe('/cable')
  })

  it('copes with storage that cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(cableUrl()).toBe('/cable')
  })
})
