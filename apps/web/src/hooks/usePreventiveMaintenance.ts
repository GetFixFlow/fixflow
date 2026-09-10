import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { pmApi } from '@/api'
import type { PMFilters } from '@/types'

export const PM_KEY = ['preventive_maintenances'] as const

export function usePMs(filters?: Partial<PMFilters>) {
  return useQuery({
    queryKey: [...PM_KEY, filters],
    queryFn: () => pmApi.list(filters).then((r) => r.data),
  })
}

export function usePM(id?: number) {
  return useQuery({
    queryKey: [...PM_KEY, id],
    queryFn: () => pmApi.get(id!).then((r) => r.data),
    enabled: !!id,
  })
}

export function usePMDashboard(dateRange?: number) {
  return useQuery({
    queryKey: [...PM_KEY, 'dashboard', dateRange],
    queryFn: () => pmApi.dashboard({ date_range: dateRange ?? 90 }).then((r) => r.data),
  })
}

export function usePMForecast(days?: number) {
  return useQuery({
    queryKey: [...PM_KEY, 'forecast', days],
    queryFn: () => pmApi.forecast(days).then((r) => r.data),
  })
}

export function usePMExecutions(pmId?: number, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...PM_KEY, pmId, 'executions', params],
    queryFn: () => pmApi.executions(pmId!, params).then((r) => r.data),
    enabled: !!pmId,
  })
}

export function usePreviewSchedule(id?: number) {
  return useQuery({
    queryKey: [...PM_KEY, id, 'preview'],
    queryFn: () => pmApi.previewSchedule(id!).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreatePM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => pmApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PM_KEY })
      toast.success('PM schedule created.')
    },
    onError: () => toast.error('Failed to create PM schedule.'),
  })
}

export function useUpdatePM(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => pmApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PM_KEY })
      toast.success('PM schedule updated.')
    },
    onError: () => toast.error('Failed to update PM schedule.'),
  })
}

export function useTriggerPM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, overrides }: { id: number; overrides?: Record<string, unknown> }) =>
      pmApi.trigger(id, overrides).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: PM_KEY })
      const woNum = data.data?.work_order_number
      toast.success(`Work order ${woNum ?? ''} created.`, { duration: 8000 })
    },
    onError: () => toast.error('Failed to trigger PM.'),
  })
}

export function usePausePM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => pmApi.pause(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PM_KEY })
      toast.success('PM schedule paused.')
    },
    onError: () => toast.error('Failed to pause PM schedule.'),
  })
}

export function useResumePM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => pmApi.resume(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PM_KEY })
      toast.success('PM schedule resumed.')
    },
    onError: () => toast.error('Failed to resume PM schedule.'),
  })
}

export function useSkipExecution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pmId, executionId, reason }: { pmId: number; executionId: number; reason: string }) =>
      pmApi.skipExecution(pmId, executionId, reason),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...PM_KEY, vars.pmId, 'executions'] })
      qc.invalidateQueries({ queryKey: PM_KEY })
      toast.success('Execution skipped.')
    },
    onError: () => toast.error('Failed to skip execution.'),
  })
}
