import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { server } from '@/test/server'
import {
  useAcknowledgeAlert, useResolveAlert, useSuppressAlert, useBulkAcknowledgeAlerts, useBulkResolveAlerts,
  useArchiveIotRule, useDuplicateIotRule, useCreateIotRule, useUpdateIotRule, usePauseIotRule, useResumeIotRule,
  useTestIotRule, useIotAlerts,
} from '../useIoT'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}
function setup<T>(hook: () => T, qc = client()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(hook, { wrapper })
}

const refused = (message: string, status = 422) => HttpResponse.json({ error: { code: 'INVALID_TRANSITION', message } }, { status })

describe('IoT hooks', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
    vi.mocked(toast.success).mockClear()
  })

  describe('alert actions', () => {
    it.each([
      ['acknowledge', useAcknowledgeAlert, 'Alert acknowledged.'],
      ['resolve', useResolveAlert, 'Alert resolved.'],
      ['suppress', useSuppressAlert, 'Alert suppressed.'],
    ])('%s: calls the alert\'s own address and says it worked', async (action, hook, message) => {
      let called = ''
      server.use(http.patch(`/api/v1/iot_alerts/:id/${action}`, ({ params }) => {
        called = String(params.id)
        return HttpResponse.json({ data: {} })
      }))
      const { result } = setup(hook)

      await act(async () => { await result.current.mutateAsync(42) })

      expect(called).toBe('42')
      expect(toast.success).toHaveBeenCalledWith(message)
      expect(toast.error).not.toHaveBeenCalled()
    })

    it.each([
      ['acknowledge', useAcknowledgeAlert],
      ['resolve', useResolveAlert],
      ['suppress', useSuppressAlert],
    ])("%s: shows the server's reason when refused, and reloads the list", async (action, hook) => {
      let listCalls = 0
      server.use(
        http.get('/api/v1/iot_alerts', () => { listCalls += 1; return HttpResponse.json({ iot_alerts: [], meta: {} }) }),
        http.patch(`/api/v1/iot_alerts/:id/${action}`, () => refused('This alert is resolved, so it cannot be changed')),
      )
      const qc = client()
      const list = setup(() => useIotAlerts(), qc)
      await waitFor(() => expect(list.result.current.isSuccess).toBe(true))
      const { result } = setup(hook, qc)

      await act(async () => { await result.current.mutateAsync(7).catch(() => undefined) })

      expect(toast.error).toHaveBeenCalledWith('This alert is resolved, so it cannot be changed')
      expect(toast.success).not.toHaveBeenCalled()
      await waitFor(() => expect(listCalls).toBe(2))
    })

    it('tells a technician that only managers can', async () => {
      server.use(http.patch('/api/v1/iot_alerts/:id/acknowledge', () => HttpResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })))
      const { result } = setup(useAcknowledgeAlert)

      await act(async () => { await result.current.mutateAsync(1).catch(() => undefined) })

      expect(toast.error).toHaveBeenCalledWith('Only managers and administrators can do that.')
    })
  })

  describe('bulk actions', () => {
    it.each([
      ['bulk_acknowledge', useBulkAcknowledgeAlerts, 'acknowledged'],
      ['bulk_resolve', useBulkResolveAlerts, 'resolved'],
    ])('%s: sends the ids and says how many were done and skipped', async (path, hook, verb) => {
      let body: unknown
      server.use(http.patch(`/api/v1/iot_alerts/${path}`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ updated: 3, skipped: 2 })
      }))
      const { result } = setup(hook)

      await act(async () => { await result.current.mutateAsync([1, 2, 3, 4, 5]) })

      expect(body).toEqual({ ids: [1, 2, 3, 4, 5] })
      expect(toast.success).toHaveBeenCalledWith(`3 alerts ${verb}, 2 skipped (already dealt with).`)
    })

    it('says "1 alert" for one, and mentions nothing skipped when none were', async () => {
      server.use(http.patch('/api/v1/iot_alerts/bulk_acknowledge', () => HttpResponse.json({ updated: 1, skipped: 0 })))
      const { result } = setup(useBulkAcknowledgeAlerts)

      await act(async () => { await result.current.mutateAsync([1]) })

      expect(toast.success).toHaveBeenCalledWith('1 alert acknowledged.')
    })

    it.each([
      ['bulk_acknowledge', useBulkAcknowledgeAlerts],
      ['bulk_resolve', useBulkResolveAlerts],
    ])('%s: shows the reason when the request is refused', async (path, hook) => {
      server.use(http.patch(`/api/v1/iot_alerts/${path}`, () => refused('no more than 200 alerts at a time', 400)))
      const { result } = setup(hook)

      await act(async () => { await result.current.mutateAsync([1]).catch(() => undefined) })

      expect(toast.error).toHaveBeenCalledWith('no more than 200 alerts at a time')
    })
  })

  describe('rule actions', () => {
    it.each([
      ['archive', useArchiveIotRule, 'patch', 'Rule archived.'],
      ['duplicate', useDuplicateIotRule, 'post', 'Rule duplicated.'],
      ['pause', usePauseIotRule, 'patch', 'Rule paused.'],
      ['resume', useResumeIotRule, 'patch', 'Rule resumed.'],
    ] as const)('%s: calls the rule\'s own address and says it worked', async (action, hook, verb, message) => {
      let called = ''
      server.use(http[verb](`/api/v1/iot_rules/:id/${action}`, ({ params }) => {
        called = String(params.id)
        return HttpResponse.json({ data: {} })
      }))
      const { result } = setup(hook)

      await act(async () => { await result.current.mutateAsync(9) })

      expect(called).toBe('9')
      expect(toast.success).toHaveBeenCalledWith(message)
    })

    it('shows why a rule could not be duplicated', async () => {
      server.use(http.post('/api/v1/iot_rules/:id/duplicate', () => refused('Name is too long')))
      const { result } = setup(useDuplicateIotRule)

      await act(async () => { await result.current.mutateAsync(9).catch(() => undefined) })

      expect(toast.error).toHaveBeenCalledWith('Name is too long')
    })

    it('shows why a rule could not be created or saved', async () => {
      server.use(
        http.post('/api/v1/iot_rules', () => refused('Threshold is not a number')),
        http.patch('/api/v1/iot_rules/:id', () => refused('Assigned to must be an active person in your company')),
      )
      const create = setup(useCreateIotRule)
      const update = setup(() => useUpdateIotRule(3))

      await act(async () => { await create.result.current.mutateAsync({ name: 'x' }).catch(() => undefined) })
      await act(async () => { await update.result.current.mutateAsync({ name: 'x' }).catch(() => undefined) })

      expect(toast.error).toHaveBeenCalledWith('Threshold is not a number')
      expect(toast.error).toHaveBeenCalledWith('Assigned to must be an active person in your company')
    })
  })

  describe('testing a rule', () => {
    it('sends the value as test_value and returns what the server worked out', async () => {
      let body: unknown
      server.use(http.post('/api/v1/iot_rules/:id/test', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ would_trigger: true, reason: 'A reading of 91 is above 85.', recent_readings: [] })
      }))
      const { result } = setup(useTestIotRule)

      let answer: unknown
      await act(async () => { answer = await result.current.mutateAsync({ id: 4, value: 91 }) })

      expect(body).toEqual({ test_value: 91 })
      expect(answer).toMatchObject({ would_trigger: true, reason: 'A reading of 91 is above 85.' })
    })

    it('shows the reason when the test is refused', async () => {
      server.use(http.post('/api/v1/iot_rules/:id/test', () => refused('test_value must be a number')))
      const { result } = setup(useTestIotRule)

      await act(async () => { await result.current.mutateAsync({ id: 4, value: 1 }).catch(() => undefined) })

      expect(toast.error).toHaveBeenCalledWith('test_value must be a number')
    })
  })
})
