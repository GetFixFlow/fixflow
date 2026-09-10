import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useComparisonData } from '../useComparisonData'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

// Mock reportStore with fixed dates
vi.mock('@/stores/reportStore', () => ({
  useReportStore: () => ({
    dateFrom: new Date('2026-02-01'),
    dateTo: new Date('2026-02-28'),
  }),
}))

describe('useComparisonData', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const qc = new QueryClient()
    return createElement(QueryClientProvider, { client: qc }, children)
  }

  it('calculates previous period correctly', () => {
    const { result } = renderHook(() => useComparisonData(), { wrapper })
    expect(result.current.prevFrom).toBeInstanceOf(Date)
    expect(result.current.prevTo).toBeInstanceOf(Date)
    // 28 days range → prev period starts 29 days before dateFrom
    expect(result.current.prevFrom < new Date('2026-01-05')).toBe(true)
  })

  it('change returns improved for positive WO count', () => {
    const { result } = renderHook(() => useComparisonData(), { wrapper })
    const { direction } = result.current.change(120, 100, 'total_wos')
    expect(direction).toBe('improved')
  })

  it('change returns degraded for increasing mttr', () => {
    const { result } = renderHook(() => useComparisonData(), { wrapper })
    const { direction } = result.current.change(10, 8, 'mttr')
    expect(direction).toBe('degraded')
  })

  it('includes percent label in change result', () => {
    const { result } = renderHook(() => useComparisonData(), { wrapper })
    const { label } = result.current.change(110, 100, 'total')
    expect(label).toContain('10.0%')
  })
})
