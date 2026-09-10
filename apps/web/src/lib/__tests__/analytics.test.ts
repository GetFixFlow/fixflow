import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportWebVitals, logWebVitals } from '../analytics'

describe('reportWebVitals', () => {
  it('does nothing without callback', () => {
    expect(() => reportWebVitals()).not.toThrow()
  })

  it('calls dynamic import with callback', async () => {
    const cb = vi.fn()
    const mockVitals = {
      onCLS: vi.fn(), onINP: vi.fn(), onFCP: vi.fn(), onLCP: vi.fn(), onTTFB: vi.fn(),
    }
    vi.doMock('web-vitals', () => mockVitals)
    // Should not throw
    expect(() => reportWebVitals(cb)).not.toThrow()
  })
})

describe('logWebVitals', () => {
  it('calls reportWebVitals without throwing', () => {
    expect(() => logWebVitals()).not.toThrow()
  })
})
