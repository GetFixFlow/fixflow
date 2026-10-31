import { describe, it, expect } from 'vitest'
import { warrantyStatus } from '../warranty'

const today = new Date(2026, 9, 16, 15, 30) // 16 Oct 2026, mid-afternoon

describe('warrantyStatus', () => {
  it('counts whole days to the end date, whatever the time of day', () => {
    expect(warrantyStatus('2026-11-15', today)).toEqual({ days: 30, tone: 'soon', text: 'ends in 30 days' })
    expect(warrantyStatus('2026-11-16', today)).toMatchObject({ days: 31, tone: 'ok', text: 'ends in 31 days' })
  })

  it('says today and tomorrow in words, and is still running on the last day', () => {
    expect(warrantyStatus('2026-10-16', today)).toEqual({ days: 0, tone: 'soon', text: 'ends today' })
    expect(warrantyStatus('2026-10-17', today)).toMatchObject({ tone: 'soon', text: 'ends tomorrow' })
  })

  it('says how long ago it ended', () => {
    expect(warrantyStatus('2026-10-15', today)).toEqual({ days: -1, tone: 'ended', text: 'ended yesterday' })
    expect(warrantyStatus('2026-09-16', today)).toMatchObject({ tone: 'ended', text: 'ended 30 days ago' })
  })
})
