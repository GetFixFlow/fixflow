import { describe, it, expect, vi } from 'vitest'
import * as webVitals from 'web-vitals'
import { reportWebVitals, logWebVitals } from '../analytics'

// The real library reads `document` from callbacks that can fire after the test
// environment is torn down, which fails the whole run. Mock it.
vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onINP: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}))

const observers = [webVitals.onCLS, webVitals.onINP, webVitals.onFCP, webVitals.onLCP, webVitals.onTTFB]

describe('reportWebVitals', () => {
  it('does nothing without callback', () => {
    expect(() => reportWebVitals()).not.toThrow()
  })

  it('registers the callback with every web vitals observer', async () => {
    const cb = vi.fn()
    reportWebVitals(cb)

    await vi.waitFor(() => {
      for (const observe of observers) expect(observe).toHaveBeenCalledWith(cb)
    })
  })
})

describe('logWebVitals', () => {
  it('registers a callback with the web vitals observers', async () => {
    vi.mocked(webVitals.onCLS).mockClear()
    logWebVitals()

    await vi.waitFor(() => expect(webVitals.onCLS).toHaveBeenCalledTimes(1))
  })
})
