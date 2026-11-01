import { describe, it, expect } from 'vitest'
import { missingRequired, shownValue, toInputValues, toPayload } from '../customFields'
import { customField } from '@/test/customFields'

const centre = customField({ label: 'Cost centre', required: true })
const budget = customField({ label: 'Budget', kind: 'number' })
const safe = customField({ label: 'Safe', kind: 'checkbox' })
const due = customField({ label: 'Review on', kind: 'date' })

describe('toInputValues', () => {
  it('holds numbers as text, as an input does, and a yes/no box as it is', () => {
    expect(toInputValues({ budget: 1500.5, safe: false, cost_centre: 'CC-1' })).toEqual({ budget: '1500.5', safe: false, cost_centre: 'CC-1' })
  })

  it('is empty for a record with no values', () => {
    expect(toInputValues(undefined)).toEqual({})
  })
})

describe('toPayload', () => {
  it('sends every field it is given, trimmed, and an empty one as an empty string so the server clears it', () => {
    expect(toPayload([centre, budget], { cost_centre: '  CC-1 ' })).toEqual({ cost_centre: 'CC-1', budget: '' })
  })

  it('sends a ticked or unticked box as it is, and one nobody touched as empty so it stays unset', () => {
    expect(toPayload([safe], { safe: true })).toEqual({ safe: true })
    expect(toPayload([safe], { safe: false })).toEqual({ safe: false })
    expect(toPayload([safe], {})).toEqual({ safe: '' })
  })

  it('leaves out a field that is not in the list (turned off)', () => {
    expect(toPayload([centre], { cost_centre: 'CC-1', old_field: 'x' })).toEqual({ cost_centre: 'CC-1' })
  })
})

describe('missingRequired', () => {
  it('names the required fields with nothing in them, blanks and spaces included', () => {
    expect(missingRequired([centre, budget], {})).toEqual({ cost_centre: 'Cost centre is required' })
    expect(missingRequired([centre], { cost_centre: '   ' })).toEqual({ cost_centre: 'Cost centre is required' })
    expect(missingRequired([centre], { cost_centre: 'CC-1' })).toEqual({})
  })

  it('does not ask for a field that is not required', () => {
    expect(missingRequired([budget], {})).toEqual({})
  })
})

describe('shownValue', () => {
  it('reads a yes/no box as Yes or No, a date as the company writes dates, and anything else as it is', () => {
    expect(shownValue(safe, true)).toBe('Yes')
    expect(shownValue(safe, false)).toBe('No')
    expect(shownValue(due, '2026-11-01')).toMatch(/2026|11|Nov/)
    expect(shownValue(budget, 12.5)).toBe('12.5')
  })

  it('is empty when there is no value, and a false box is a value', () => {
    expect(shownValue(budget, undefined)).toBe('')
    expect(shownValue(budget, '')).toBe('')
    expect(shownValue(safe, false)).toBe('No')
  })
})
