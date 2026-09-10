import { describe, it, expect } from 'vitest'
import { calculateCompliance, percentChange, getTrendDirection, groupByPeriod } from '../reportUtils'

describe('calculateCompliance', () => {
  it('returns 100 when nothing scheduled', () => {
    expect(calculateCompliance(0, 0)).toBe(100)
  })
  it('calculates percentage correctly', () => {
    expect(calculateCompliance(10, 8)).toBe(80)
  })
  it('caps at 100 with rounding', () => {
    expect(calculateCompliance(3, 3)).toBe(100)
  })
})

describe('percentChange', () => {
  it('returns 100 for zero->positive', () => {
    expect(percentChange(10, 0)).toBe(100)
  })
  it('returns correct change', () => {
    expect(percentChange(120, 100)).toBe(20)
    expect(percentChange(80, 100)).toBe(-20)
  })
})

describe('getTrendDirection', () => {
  it('improved when count metric goes up', () => {
    expect(getTrendDirection('total_wos', 10)).toBe('improved')
  })
  it('degraded when mttr goes up', () => {
    expect(getTrendDirection('mttr', 15)).toBe('degraded')
  })
  it('neutral for tiny changes', () => {
    expect(getTrendDirection('total', 0.05)).toBe('neutral')
  })
})

describe('groupByPeriod', () => {
  it('groups by day', () => {
    const data = [
      { created_at: '2026-01-01T10:00:00Z', id: 1 },
      { created_at: '2026-01-01T14:00:00Z', id: 2 },
      { created_at: '2026-01-02T09:00:00Z', id: 3 },
    ]
    const groups = groupByPeriod(data, 'created_at', 'day')
    expect(groups.size).toBe(2)
    expect(groups.get('2026-01-01')?.length).toBe(2)
  })
})
