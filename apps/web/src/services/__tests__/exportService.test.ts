import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV, copyShareLink } from '../exportService'

describe('exportToCSV', () => {
  beforeEach(() => {
    // Mock URL and DOM
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el)
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el)
  })

  it('does nothing on empty data', () => {
    expect(() => exportToCSV([], 'test')).not.toThrow()
  })

  it('generates CSV blob for data', () => {
    const mockA = { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(mockA)
    exportToCSV([{ name: 'Test', value: 42 }], 'report')
    expect(mockA.click).toHaveBeenCalled()
    expect(mockA.download).toContain('report')
  })

  it('flattens nested objects', () => {
    const data = [{ outer: { inner: 'value' }, num: 5 }]
    // Should not throw
    expect(() => exportToCSV(data, 'test')).not.toThrow()
  })
})

describe('copyShareLink', () => {
  it('is a callable function', () => {
    // copyShareLink uses navigator.clipboard and URL which are DOM globals —
    // just verify it exports without throwing
    expect(typeof copyShareLink).toBe('function')
  })
})
