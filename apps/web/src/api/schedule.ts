import { apiClient } from './client'
import type { WorkOrder } from '@/types'
import type { RescheduleInput, Schedule } from '@/types/schedule'

export const scheduleApi = {
  get: (from: string, to: string) => apiClient.get<{ data: Schedule }>('/schedule', { params: { from, to } }),

  reschedule: (workOrderId: number, input: RescheduleInput) =>
    apiClient.patch<{ data: WorkOrder }>(`/work_orders/${workOrderId}/reschedule`, input),
}
