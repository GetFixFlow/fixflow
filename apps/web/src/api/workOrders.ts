import { apiClient } from './client'
import type {
  WorkOrder,
  WorkOrderComment,
  WorkOrderAttachment,
  WorkOrderPart,
  WorkRequest,
} from '@/types'

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

  transition: (id: number, event: string, payload?: Record<string, unknown>) =>
    apiClient.patch<{ data: WorkOrder }>(`/work_orders/${id}/transition`, { event, ...payload }),

  // Comments
  listComments: (id: number) =>
    apiClient.get<{ comments: WorkOrderComment[] }>(`/work_orders/${id}/comments`),

  createComment: (id: number, body: string, is_internal: boolean) =>
    apiClient.post<{ data: WorkOrderComment }>(`/work_orders/${id}/comments`, {
      comment: { body, is_internal },
    }),

  deleteComment: (id: number, commentId: number) =>
    apiClient.delete(`/work_orders/${id}/comments/${commentId}`),

  // Attachments
  listAttachments: (id: number) =>
    apiClient.get<{ attachments: WorkOrderAttachment[] }>(`/work_orders/${id}/attachments`),

  uploadAttachment: (id: number, file: File) => {
    const form = new FormData()
    form.append('attachment[file]', file)
    return apiClient.post<{ data: WorkOrderAttachment }>(`/work_orders/${id}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteAttachment: (id: number, attachmentId: number) =>
    apiClient.delete(`/work_orders/${id}/attachments/${attachmentId}`),

  // Parts
  listParts: (id: number) =>
    apiClient.get<{ parts: WorkOrderPart[] }>(`/work_orders/${id}/parts`),

  logPart: (id: number, data: { part_id: number; quantity_used: number; unit_cost: number }) =>
    apiClient.post<{ data: WorkOrderPart }>(`/work_orders/${id}/parts`, { part: data }),

  removePart: (id: number, partId: number) =>
    apiClient.delete(`/work_orders/${id}/parts/${partId}`),

  // Checklist
  updateChecklist: (id: number, checklist_items: unknown[]) =>
    apiClient.patch<{ data: WorkOrder }>(`/work_orders/${id}`, {
      work_order: { checklist_items },
    }),
}

// Public work request portal (no auth)
export const workRequestsApi = {
  create: (data: {
    requester_name: string
    requester_email: string
    description: string
    location_id?: number
    asset_description?: string
  }) => apiClient.post<{ data: WorkRequest; token: string }>('/work_requests', { work_request: data }),

  get: (token: string) =>
    apiClient.get<{ data: WorkRequest }>(`/work_requests/${token}`),
}
