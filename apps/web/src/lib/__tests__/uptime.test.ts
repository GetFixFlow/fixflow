import { describe, it, expect } from 'vitest'
import { formatUptime } from '../uptime'

describe('formatUptime', () => {
  it('says seconds for a fresh start, with the right plural', () => {
    expect(formatUptime(0)).toBe('0 seconds')
    expect(formatUptime(1)).toBe('1 second')
    expect(formatUptime(40)).toBe('40 seconds')
  })

  it('says the two largest units that are not zero', () => {
    expect(formatUptime(60)).toBe('1 minute')
    expect(formatUptime(2 * 3600 + 5 * 60 + 9)).toBe('2 hours 5 minutes')
    expect(formatUptime(3 * 86400 + 4 * 3600 + 59 * 60)).toBe('3 days 4 hours')
    expect(formatUptime(86400)).toBe('1 day')
    expect(formatUptime(86400 + 59)).toBe('1 day')
  })

  it('does not go below zero', () => {
    expect(formatUptime(-5)).toBe('0 seconds')
  })
})
