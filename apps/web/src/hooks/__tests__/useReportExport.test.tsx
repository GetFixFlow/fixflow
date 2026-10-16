import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import { useReportExport } from '../useReportExport'

const saved = vi.hoisted(() => ({ files: [] as Array<{ blob: Blob; filename: string }> }))
vi.mock('@/services/exportService', () => ({
  triggerDownload: (blob: Blob, filename: string) => saved.files.push({ blob, filename }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }))

const csv = (headers: Record<string, string> = {}) =>
  new HttpResponse('a,b\n1,2\n', { headers: { 'Content-Type': 'text/csv', ...headers } })

async function exportOnce(path = 'work_orders/summary', params?: Record<string, unknown>) {
  const { result } = renderHook(() => useReportExport())
  await act(async () => {
    await result.current.exportReport(path, 'csv', params)
  })
  return result
}

describe('useReportExport', () => {
  beforeEach(() => {
    saved.files.length = 0
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.warning).mockClear()
  })

  it('saves the file under the name the server gave it', async () => {
    server.use(
      http.get('/api/v1/reports/work_orders/summary.csv', () =>
        csv({ 'Content-Disposition': 'attachment; filename="work_orders_2026-10-16.csv"; filename*=UTF-8\'\'work_orders_2026-10-16.csv' }),
      ),
    )

    await exportOnce()

    expect(saved.files.map((f) => f.filename)).toEqual(['work_orders_2026-10-16.csv'])
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('falls back to a name made from the report when the server gave none', async () => {
    server.use(http.get('/api/v1/reports/costs/by_asset.csv', () => csv()))

    await exportOnce('costs/by_asset')

    expect(saved.files.map((f) => f.filename)).toEqual(['costs_by_asset.csv'])
  })

  it('sends the dates and filters, lists as the server reads them', async () => {
    let seen = ''
    server.use(
      http.get('/api/v1/reports/work_orders/summary.csv', ({ request }) => {
        seen = new URL(request.url).search
        return csv()
      }),
    )

    await exportOnce('work_orders/summary', { from: '2026-10-01', priorities: ['high', 'low'], location_ids: [3] })

    const search = new URLSearchParams(seen)
    expect(search.get('from')).toBe('2026-10-01')
    expect(search.getAll('priorities[]')).toEqual(['high', 'low'])
    expect(search.getAll('location_ids[]')).toEqual(['3'])
  })

  it('warns when the server stopped at its row limit, and still saves the file', async () => {
    server.use(http.get('/api/v1/reports/work_orders/summary.csv', () => csv({ 'X-Export-Truncated': 'true' })))

    await exportOnce()

    expect(saved.files).toHaveLength(1)
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/first 50,000 rows/))
  })

  it.each([
    [403, { error: { code: 'FORBIDDEN', message: 'You are not authorized to perform this action' } }, /only managers and administrators/i],
    [406, { error: { code: 'UNSUPPORTED_FORMAT' } }, /cannot be exported in that format/i],
    [429, { error: { code: 'RATE_LIMITED' } }, /too many requests/i],
    [422, { error: { code: 'BAD_REQUEST', message: 'from must be before to' } }, /from must be before to/i],
    [500, 'not json at all', /could not be created/i],
  ])('says what went wrong for a %i answer, and saves nothing', async (status, body, message) => {
    server.use(
      http.get('/api/v1/reports/work_orders/summary.csv', () =>
        typeof body === 'string' ? new HttpResponse(body, { status }) : HttpResponse.json(body, { status }),
      ),
    )

    await exportOnce()

    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(message))
    expect(saved.files).toHaveLength(0)
  })

  it('says so when the server cannot be reached', async () => {
    server.use(http.get('/api/v1/reports/work_orders/summary.csv', () => HttpResponse.error()))

    await exportOnce()

    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/could not be created/i))
  })

  it('is busy while the file is made, and free again afterwards', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get('/api/v1/reports/work_orders/summary.csv', async () => {
        await gate
        return csv()
      }),
    )
    const { result } = renderHook(() => useReportExport())

    let done: Promise<void> = Promise.resolve()
    act(() => {
      done = result.current.exportReport('work_orders/summary', 'csv')
    })
    await waitFor(() => expect(result.current.exporting).toBe(true))
    release()
    await act(async () => {
      await done
    })

    expect(result.current.exporting).toBe(false)
  })

  it('is free again after a failure too', async () => {
    server.use(http.get('/api/v1/reports/work_orders/summary.csv', () => HttpResponse.json({}, { status: 500 })))

    const result = await exportOnce()

    expect(result.current.exporting).toBe(false)
  })
})
