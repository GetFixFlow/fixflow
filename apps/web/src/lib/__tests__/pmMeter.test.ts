import { describe, it, expect } from 'vitest'
import { meterDueText } from '../pmMeter'

const meter = { id: 3, name: 'Running hours', unit: 'hours', reading: 4120.5 }

describe('meterDueText', () => {
  it('says where a schedule falls due, where the meter is, and how far it is', () => {
    expect(meterDueText({ frequency_type: 'meter_based', meter, next_due_reading: 4370.5 })).toBe('At 4,370.5 hours (now 4,120.5, 250 to go)')
  })

  it('says due now once the meter has got there', () => {
    expect(meterDueText({ frequency_type: 'meter_based', meter: { ...meter, reading: 4400 }, next_due_reading: 4370.5 })).toContain('due now')
  })

  it('is nothing for a schedule by time, and says so for a meter schedule made before meters existed', () => {
    expect(meterDueText({ frequency_type: 'time_based', meter: null, next_due_reading: null })).toBeNull()
    expect(meterDueText({ frequency_type: 'meter_based', meter: null, next_due_reading: null })).toBe('Follows no meter yet')
  })
})
