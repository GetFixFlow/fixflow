import { describe, it, expect } from 'vitest'
import { AUDIT_CHOICES, SENSOR_CHOICES, describeDays, formatBytes, withCurrent } from '../retentionText'

describe('formatBytes', () => {
  it('reads sizes the way a person does', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatBytes(1.4 * 1024 ** 3)).toBe('1.4 GB')
    expect(formatBytes(250 * 1024 ** 2)).toBe('250 MB')
    expect(formatBytes(3 * 1024 ** 4)).toBe('3 TB')
  })

  it('does not go below zero', () => {
    expect(formatBytes(-5)).toBe('0 B')
  })
})

describe('describeDays', () => {
  it('says years for whole years and days otherwise', () => {
    expect(describeDays(365)).toBe('1 year')
    expect(describeDays(730)).toBe('2 years')
    expect(describeDays(2555)).toBe('7 years')
    expect(describeDays(90)).toBe('90 days')
    expect(describeDays(1)).toBe('1 day')
    expect(describeDays(400)).toBe('400 days')
  })

  it('says for ever for zero only where zero means that', () => {
    expect(describeDays(0, true)).toBe('For ever')
    expect(describeDays(0)).toBe('0 days')
  })
})

describe('withCurrent', () => {
  it('keeps the usual choices, and adds a value set some other way, in order', () => {
    expect(withCurrent(SENSOR_CHOICES, 365)).toEqual(SENSOR_CHOICES)
    expect(withCurrent(SENSOR_CHOICES, 120)).toEqual([7, 14, 30, 90, 120, 180, 365, 730, 1095, 1825, 3650])
    expect(withCurrent(AUDIT_CHOICES, 0)).toEqual(AUDIT_CHOICES)
    expect(withCurrent(AUDIT_CHOICES, 400)).toEqual([0, 365, 400, 730, 1095, 1825, 2555])
  })
})
