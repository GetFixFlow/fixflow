import { apiClient } from './client'
import type { WorkOrder } from '@/types'

export const workOrdersApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ work_orders: WorkOrder[]; meta: unknown }>('/work_orders', { params }),

  get: (id: number) =>
    apiClient.get<{ data: WorkOrder }>(`/work_orders/${id}`),

  create: (data: Partial<WorkOrder>) =>
    apiClient.post<{ data: WorkOrder }>('/work_orders', { work_order: data }),

  update: (id: number, data: Partial<WorkOrder>) =>
    apiClient.patch<{ data: WorkOrder }>(`/work_orders/${id}`, { work_order: data }),

  destroy: (id: number) => apiClient.delete(`/work_orders/${id}`),

  transition: (id: number, event: string) =>
    apiClient.patch<{ data: WorkOrder }>(`/work_orders/${id}/transition`, { event }),
}
