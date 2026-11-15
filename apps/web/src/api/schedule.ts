import { apiClient } from './client'
import type { WorkOrder } from '@/types'
import type { RescheduleInput, Schedule } from '@/types/schedule'

export const scheduleApi = {
  /** One site's calendar and work when `siteId` is given. */
  get: (from: string, to: string, siteId?: number | null) =>
    apiClient.get<{ data: Schedule }>('/schedule', { params: { from, to, ...(siteId ? { site_id: siteId } : {}) } }),

  reschedule: (workOrderId: number, input: RescheduleInput) =>
    apiClient.patch<{ data: WorkOrder }>(`/work_orders/${workOrderId}/reschedule`, input),
}
