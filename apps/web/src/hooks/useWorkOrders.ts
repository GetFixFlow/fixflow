import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workOrdersApi } from '@/api'
import type { WorkOrder, ChecklistItem } from '@/types'

export const WO_KEY = ['work_orders'] as const

export function useWorkOrders(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...WO_KEY, params],
    queryFn: () => workOrdersApi.list(params).then((r) => r.data),
  })
}

export function useWorkOrder(id?: number) {
  return useQuery({
    queryKey: [...WO_KEY, id],
    queryFn: () => workOrdersApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  })
}

export function useCreateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WorkOrder>) => workOrdersApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      toast.success(`Work order ${res.data.data.work_order_number} created.`)
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

export function useDeleteWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => workOrdersApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      toast.success('Work order cancelled.')
    },
    onError: () => toast.error('Failed to cancel work order.'),
  })
}

export function useTransitionWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      event,
      payload,
    }: {
      id: number
      event: string
      payload?: Record<string, unknown>
    }) => workOrdersApi.transition(id, event, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: [...WO_KEY, vars.id] })
      toast.success('Status updated.')
    },
    onError: () => toast.error('Invalid transition.'),
  })
}

export function useAssignWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assignee_id }: { id: number; assignee_id: number }) =>
      workOrdersApi.update(id, { assignee_id }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: [...WO_KEY, vars.id] })
      toast.success('Work order assigned.')
    },
    onError: () => toast.error('Failed to assign work order.'),
  })
}

export function useCompleteWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      completion_notes,
      actual_hours,
      resolution_type,
    }: {
      id: number
      completion_notes: string
      actual_hours: number
      resolution_type: string
    }) =>
      workOrdersApi.transition(id, 'complete', {
        work_order: { completion_notes, actual_hours, resolution_type },
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: [...WO_KEY, vars.id] })
      toast.success('Work order marked as complete.')
    },
    onError: () => toast.error('Failed to complete work order.'),
  })
}

export function useVerifyWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      workOrdersApi.transition(id, 'verify', note ? { work_order: { verification_note: note } } : {}),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: [...WO_KEY, vars.id] })
      toast.success('Work order verified and closed.')
    },
    onError: () => toast.error('Failed to verify work order.'),
  })
}

export function useRejectWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      reason,
      reassign_to,
    }: {
      id: number
      reason: string
      reassign_to?: number
    }) =>
      workOrdersApi.transition(id, 'reject', {
        work_order: { rejection_reason: reason, reassign_to },
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: [...WO_KEY, vars.id] })
      toast.success('Work order returned to assignee.')
    },
    onError: () => toast.error('Failed to reject work order.'),
  })
}

// Comments
export const WO_COMMENTS_KEY = (id: number) => [...WO_KEY, id, 'comments'] as const

export function useWorkOrderComments(id: number) {
  return useQuery({
    queryKey: WO_COMMENTS_KEY(id),
    queryFn: () => workOrdersApi.listComments(id).then((r) => r.data.comments),
    enabled: !!id,
  })
}

export function useCreateComment(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, is_internal }: { body: string; is_internal: boolean }) =>
      workOrdersApi.createComment(workOrderId, body, is_internal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_COMMENTS_KEY(workOrderId) })
    },
    onError: () => toast.error('Failed to post comment.'),
  })
}

export function useDeleteComment(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: number) => workOrdersApi.deleteComment(workOrderId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: WO_COMMENTS_KEY(workOrderId) }),
    onError: () => toast.error('Failed to delete comment.'),
  })
}

// Attachments
export const WO_ATTACHMENTS_KEY = (id: number) => [...WO_KEY, id, 'attachments'] as const

export function useWorkOrderAttachments(id: number) {
  return useQuery({
    queryKey: WO_ATTACHMENTS_KEY(id),
    queryFn: () => workOrdersApi.listAttachments(id).then((r) => r.data.attachments),
    enabled: !!id,
  })
}

export function useUploadAttachment(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => workOrdersApi.uploadAttachment(workOrderId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: WO_ATTACHMENTS_KEY(workOrderId) }),
    onError: () => toast.error('Failed to upload attachment.'),
  })
}

// Parts
export const WO_PARTS_KEY = (id: number) => [...WO_KEY, id, 'parts'] as const

export function useWorkOrderParts(id: number) {
  return useQuery({
    queryKey: WO_PARTS_KEY(id),
    queryFn: () => workOrdersApi.listParts(id).then((r) => r.data.parts),
    enabled: !!id,
  })
}

export function useLogPart(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { part_id: number; quantity_used: number; unit_cost: number }) =>
      workOrdersApi.logPart(workOrderId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_PARTS_KEY(workOrderId) })
      qc.invalidateQueries({ queryKey: [...WO_KEY, workOrderId] })
      toast.success('Parts logged.')
    },
    onError: () => toast.error('Failed to log parts.'),
  })
}

// Checklist
export function useUpdateChecklist(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: ChecklistItem[]) => workOrdersApi.updateChecklist(workOrderId, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...WO_KEY, workOrderId] }),
  })
}
