import { describe, it, expect } from 'vitest'
import { fromInputValue, toInputValue } from '../dateTimeInput'

describe('dateTimeInput', () => {
  it('writes a moment the way a datetime-local field wants it, in the person\'s own time', () => {
    expect(toInputValue(new Date(2026, 9, 6, 9, 5))).toBe('2026-10-06T09:05')
    expect(toInputValue(new Date(2026, 9, 6, 9, 5).toISOString())).toBe('2026-10-06T09:05')
  })

  it('turns what the field holds into a moment the server reads, and nothing into nothing', () => {
    expect(fromInputValue('2026-10-06T09:05')).toBe(new Date(2026, 9, 6, 9, 5).toISOString())
    expect(fromInputValue('')).toBeUndefined()
    expect(fromInputValue('not a time')).toBeUndefined()
  })
})
