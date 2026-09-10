import { describe, it, expect } from 'vitest'
import { formatCurrency, formatHours, formatPercent, fillDateGaps, generateDateSeries, getStatusColor, getPriorityColor } from '../chartUtils'

describe('formatCurrency', () => {
  it('formats positive number', () => {
    expect(formatCurrency(1500)).toContain('1,500')
    expect(formatCurrency(1500)).toContain('$')
  })
  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('$0')
  })
})

describe('formatHours', () => {
  it('shows minutes for sub-hour', () => {
    expect(formatHours(0.5)).toBe('30 min')
  })
  it('shows hours for >= 1 hour', () => {
    expect(formatHours(2.5)).toBe('2.5 hrs')
  })
})

describe('formatPercent', () => {
  it('formats with 1 decimal by default', () => {
    expect(formatPercent(75.5)).toBe('75.5%')
  })
  it('respects decimals param', () => {
    expect(formatPercent(75.555, 2)).toBe('75.56%')
  })
})

describe('generateDateSeries', () => {
  it('generates daily series', () => {
    const from = new Date('2026-01-01')
    const to = new Date('2026-01-05')
    const series = generateDateSeries(from, to, 'day')
    expect(series).toHaveLength(5)
    expect(series[0]).toBe('2026-01-01')
  })
})

describe('fillDateGaps', () => {
  it('fills missing dates with defaults', () => {
    const data = [{ date: '2026-01-03', count: 5 }]
    const result = fillDateGaps(data, new Date('2026-01-01'), new Date('2026-01-03'), 'day', { count: 0 })
    expect(result).toHaveLength(3)
    expect(result[0].count).toBe(0)
    expect(result[2].count).toBe(5)
  })
})

describe('getStatusColor', () => {
  it('returns color for known status', () => {
    expect(getStatusColor('operational')).toBe('#22c55e')
    expect(getStatusColor('down')).toBe('#ef4444')
  })
  it('returns gray for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('#6b7280')
  })
})

describe('getPriorityColor', () => {
  it('returns correct colors', () => {
    expect(getPriorityColor('critical')).toBe('#ef4444')
    expect(getPriorityColor('low')).toBe('#3b82f6')
  })
})
