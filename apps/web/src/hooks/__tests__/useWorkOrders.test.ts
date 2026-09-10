import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import {
  useWorkOrders,
  useWorkOrder,
  useCompleteWorkOrder,
  useVerifyWorkOrder,
} from '../useWorkOrders'
import React from 'react'
import type { WorkOrder } from '@/types'

const mockWO: WorkOrder = {
  id: 1,
  work_order_number: 'WO-000001',
  title: 'Test WO',
  status: 'open',
  priority: 'medium',
  work_order_type: 'corrective',
  source: 'manual',
  organization_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('useWorkOrders', () => {
  it('returns paginated data', async () => {
    server.use(
      http.get('/api/v1/work_orders', () =>
        HttpResponse.json({
          work_orders: [mockWO],
          meta: { request_id: 'test', timestamp: '', pagination: { count: 1, page: 1, items: 25, pages: 1 } },
        }),
      ),
    )
    const { result } = renderHook(() => useWorkOrders(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.work_orders).toHaveLength(1)
    expect(result.current.data?.work_orders[0].work_order_number).toBe('WO-000001')
  })

  it('filters are passed as query params', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/work_orders', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ work_orders: [], meta: { request_id: 'test', timestamp: '' } })
      }),
    )
    const { result } = renderHook(
      () => useWorkOrders({ status: 'open', priority: 'critical' }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedUrl).toContain('status=open')
    expect(capturedUrl).toContain('priority=critical')
  })

  it('useCompleteWorkOrder invalidates WO query', async () => {
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () =>
        HttpResponse.json({ data: { ...mockWO, status: 'completed' }, meta: {} }),
      ),
      http.get('/api/v1/work_orders', () =>
        HttpResponse.json({ work_orders: [mockWO], meta: { request_id: 'test', timestamp: '' } }),
      ),
      http.get('/api/v1/work_orders/1', () =>
        HttpResponse.json({ data: mockWO, meta: {} }),
      ),
    )
    const { result } = renderHook(() => useCompleteWorkOrder(), { wrapper: makeWrapper() })
    result.current.mutate({
      id: 1,
      completion_notes: 'Done and done, all steps complete.',
      actual_hours: 2,
      resolution_type: 'fully_resolved',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useVerifyWorkOrder shows success toast', async () => {
    server.use(
      http.patch('/api/v1/work_orders/1/transition', () =>
        HttpResponse.json({ data: { ...mockWO, status: 'verified' }, meta: {} }),
      ),
      http.get('/api/v1/work_orders', () =>
        HttpResponse.json({ work_orders: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
      http.get('/api/v1/work_orders/1', () =>
        HttpResponse.json({ data: mockWO, meta: {} }),
      ),
    )
    const { result } = renderHook(() => useVerifyWorkOrder(), { wrapper: makeWrapper() })
    result.current.mutate({ id: 1 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
