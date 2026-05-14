import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workOrdersApi } from '@/api'
import type { WorkOrder } from '@/types'

export const WO_KEY = ['work_orders'] as const

export function useWorkOrders(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...WO_KEY, params],
    queryFn: () => workOrdersApi.list(params).then((r) => r.data),
  })
}

export function useWorkOrder(id: number) {
  return useQuery({
    queryKey: [...WO_KEY, id],
    queryFn: () => workOrdersApi.get(id).then((r) => r.data.data),
    enabled: !!id,
  })
}

export function useCreateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WorkOrder>) => workOrdersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      toast.success('Work order created.')
    },
    onError: () => toast.error('Failed to create work order.'),
  })
}

export function useUpdateWorkOrder(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WorkOrder>) => workOrdersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      toast.success('Work order updated.')
    },
    onError: () => toast.error('Failed to update work order.'),
  })
}

export function useTransitionWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, event }: { id: number; event: string }) =>
      workOrdersApi.transition(id, event),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      toast.success('Status updated.')
    },
    onError: () => toast.error('Invalid transition.'),
  })
}
