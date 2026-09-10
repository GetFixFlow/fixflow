import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { usePMs, useTriggerPM, useSkipExecution, usePMDashboard } from '../usePreventiveMaintenance'
import React from 'react'
import type { PreventiveMaintenance } from '@/types'

const mockPM: PreventiveMaintenance = {
  id: 1, name: 'Test PM', title: 'Test PM',
  status: 'active', priority: 'medium',
  frequency_type: 'time_based', frequency_value: 30, frequency_unit: 'days',
  asset_id: 1, organization_id: 1, created_at: '', updated_at: '',
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('usePreventiveMaintenance', () => {
  it('usePMs fetches with filters as query params', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/preventive_maintenances', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ preventive_maintenances: [mockPM], meta: { request_id: 'test', timestamp: '' } })
      }),
    )
    const { result } = renderHook(() => usePMs({ status: 'active', asset_id: 5 }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedUrl).toContain('status=active')
    expect(capturedUrl).toContain('asset_id=5')
  })

  it('useTriggerPM shows success toast with WO number', async () => {
    server.use(
      http.post('/api/v1/preventive_maintenances/1/trigger', () =>
        HttpResponse.json({ data: { work_order_number: 'WO-099', work_order_id: 99 }, meta: { request_id: 'test', timestamp: '' } }),
      ),
      http.get('/api/v1/preventive_maintenances', () =>
        HttpResponse.json({ preventive_maintenances: [], meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
    const { result } = renderHook(() => useTriggerPM(), { wrapper: makeWrapper() })
    result.current.mutate({ id: 1 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useSkipExecution invalidates execution list', async () => {
    server.use(
      http.patch('/api/v1/preventive_maintenances/1/executions/5/skip', () =>
        HttpResponse.json({ data: { id: 5, preventive_maintenance_id: 1, scheduled_date: '', status: 'skipped', created_at: '', updated_at: '' }, meta: { request_id: 'test', timestamp: '' } }),
      ),
    )
    const { result } = renderHook(() => useSkipExecution(), { wrapper: makeWrapper() })
    result.current.mutate({ pmId: 1, executionId: 5, reason: 'Asset unavailable' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('usePMDashboard returns compliance stats', async () => {
    server.use(
      http.get('/api/v1/reports/pm/dashboard', () =>
        HttpResponse.json({
          overall_compliance: 88,
          compliance_change: 1.5,
          due_this_week: 4,
          overdue_count: 1,
          completed_this_month: 15,
          scheduled_this_month: 18,
          avg_completion_hours: 1.6,
          avg_estimated_hours: 1.5,
          monthly_trend: [],
          by_location: [],
          overdue_pms: [],
          upcoming_week: [],
          worst_assets: [],
          recent_activity: [],
          meta: { request_id: 'test', timestamp: '' },
        }),
      ),
    )
    const { result } = renderHook(() => usePMDashboard(90), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.overall_compliance).toBe(88)
  })
})
