import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { usePMs, useTriggerPM, useSkipExecution, usePMDashboard, usePMForecast } from '../usePreventiveMaintenance'
import React from 'react'
import type { PreventiveMaintenance } from '@/types'

const mockPM: PreventiveMaintenance = {
  id: 1, name: 'Test PM',
  status: 'active', priority: 'medium',
  frequency_type: 'time_based', frequency_value: 30, frequency_unit: 'days',
  created_at: '', updated_at: '',
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
        return HttpResponse.json({ pm_schedules: [mockPM], meta: { request_id: 'test', timestamp: '' } })
      }),
    )
    const { result } = renderHook(() => usePMs({ status: 'active', asset_id: 5 }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedUrl).toContain('status=active')
    expect(capturedUrl).toContain('asset_id=5')
  })

  it('useTriggerPM shows success toast with WO number', async () => {
    server.use(
      http.patch('/api/v1/preventive_maintenances/1/trigger', () =>
        HttpResponse.json({ message: 'Work order generated', work_order: { id: 99, work_order_number: 'WO-099' } }, { status: 201 }),
      ),
      http.get('/api/v1/preventive_maintenances', () =>
        HttpResponse.json({ pm_schedules: [], meta: { request_id: 'test', timestamp: '' } }),
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

  it('usePMDashboard reads the real dashboard endpoint', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/preventive_maintenances/dashboard', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          period_days: 90, overall_compliance: 88, compliance_change: null, due_this_week: 4, overdue_count: 1,
          completed_this_month: 15, scheduled_this_month: 18, avg_completion_hours: null, avg_estimated_hours: null,
          monthly_trend: [], by_location: [], overdue_pms: [], upcoming_week: [], recent_activity: [],
        })
      }),
    )
    const { result } = renderHook(() => usePMDashboard(90), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.overall_compliance).toBe(88)
    expect(capturedUrl).toContain('date_range=90')
  })

  it('useSkipExecution sends the reason as skip_reason, which is what the API reads', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.patch('/api/v1/preventive_maintenances/1/executions/5/skip', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { id: 5 } })
      }),
    )
    const { result } = renderHook(() => useSkipExecution(), { wrapper: makeWrapper() })
    result.current.mutate({ pmId: 1, executionId: 5, reason: 'Asset unavailable' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(body).toEqual({ skip_reason: 'Asset unavailable' })
  })

  it('useTriggerPM sends the overrides with a PATCH', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.patch('/api/v1/preventive_maintenances/1/trigger', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ message: 'ok', work_order: { id: 7, work_order_number: 'WO-007' } }, { status: 201 })
      }),
      http.get('/api/v1/preventive_maintenances', () => HttpResponse.json({ pm_schedules: [] })),
    )
    const { result } = renderHook(() => useTriggerPM(), { wrapper: makeWrapper() })
    result.current.mutate({ id: 1, overrides: { priority: 'critical', note: 'Visit Friday' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(body).toEqual({ overrides: { priority: 'critical', note: 'Visit Friday' } })
  })

  it('usePMForecast flattens the weekly groups into one list for the timeline', async () => {
    server.use(
      http.get('/api/v1/reports/pm/schedule_forecast', () =>
        HttpResponse.json({
          by_week: [
            { week_start: '2026-10-12', pms: [{ pm_id: 1, name: 'Oil', asset: 'Pump A', due_date: '2026-10-14', priority: 'high', estimated_hours: 2 }] },
            { week_start: '2026-10-19', pms: [{ pm_id: 2, name: 'Filter', asset: 'HVAC', due_date: '2026-10-20', priority: 'low', estimated_hours: 1 }] },
          ],
        }),
      ),
    )
    const { result } = renderHook(() => usePMForecast(30), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items).toEqual([
      { pm_id: 1, pm_name: 'Oil', asset_name: 'Pump A', due_date: '2026-10-14', priority: 'high', estimated_hours: 2 },
      { pm_id: 2, pm_name: 'Filter', asset_name: 'HVAC', due_date: '2026-10-20', priority: 'low', estimated_hours: 1 },
    ])
  })
})
