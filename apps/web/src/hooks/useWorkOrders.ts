import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { workOrdersApi } from '@/api'
import { usePendingActions } from '@/hooks/useOfflineQueue'
import { applyPending, isOfflineEvent, newClientId, offlineQueue, type OfflineEvent } from '@/lib/offlineQueue'
import { isNetworkError } from '@/lib/offlineSync'
import { fileStore } from '@/lib/fileStore'
import { prepareUpload } from '@/lib/imagePrep'
import { useAuthStore } from '@/stores/authStore'
import type { WorkOrder, WorkOrderComment, ChecklistItem } from '@/types'

export const WO_KEY = ['work_orders'] as const

export function useWorkOrders(params?: Record<string, unknown>) {
  const query = useQuery({
    queryKey: [...WO_KEY, params],
    queryFn: () => workOrdersApi.list(params).then((r) => r.data),
  })
  const pending = usePendingActions()
  const data = useMemo(
    () =>
      query.data && pending.length > 0
        ? { ...query.data, work_orders: query.data.work_orders.map((wo) => applyPending(wo, pending)) }
        : query.data,
    [query.data, pending],
  )
  return { ...query, data }
}

/** The work order, with this person's not-yet-sent changes already showing. */
export function useWorkOrder(id?: number) {
  const query = useQuery({
    queryKey: [...WO_KEY, id],
    queryFn: () => workOrdersApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  })
  const pending = usePendingActions(id)
  const data = useMemo(() => (query.data ? applyPending(query.data, pending) : query.data), [query.data, pending])
  return { ...query, data }
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

const QUEUED_MESSAGE = 'Saved on this device. It will be sent when you are back online.'

/** What a queued change is called in messages: "Start work on WO-000012". */
function describe(qc: QueryClient, id: number, what: string) {
  const number = qc.getQueryData<WorkOrder>([...WO_KEY, id])?.work_order_number
  return `${what} on ${number ?? `work order ${id}`}`
}

const EVENT_WORDS: Record<OfflineEvent, string> = {
  start: 'Start work',
  hold: 'Put on hold',
  pending_parts: 'Waiting for parts',
  need_parts: 'Waiting for parts',
  resume: 'Resume work',
  complete: 'Mark complete',
}

/**
 * Sends a status change. A field event (start, hold, need parts, resume, complete) that cannot be
 * sent for lack of a connection is kept on the device and sent later; anything else fails as before.
 */
async function sendTransition(
  qc: QueryClient,
  { id, event, payload }: { id: number; event: string; payload?: Record<string, unknown> },
): Promise<{ queued: boolean }> {
  const keep = () => {
    offlineQueue.enqueue({
      type: 'transition',
      workOrderId: id,
      event: event as OfflineEvent,
      payload,
      label: describe(qc, id, EVENT_WORDS[event as OfflineEvent]),
    })
    return { queued: true }
  }
  const canKeep = isOfflineEvent(event) && offlineQueue.canQueue()

  if (canKeep && !navigator.onLine) return keep()
  try {
    await workOrdersApi.transition(id, event, payload)
    return { queued: false }
  } catch (error) {
    if (canKeep && isNetworkError(error)) return keep()
    throw error
  }
}

export function useTransitionWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    // Always run, even offline: it is this function that decides to keep the change for later.
    networkMode: 'always',
    mutationFn: (vars: { id: number; event: string; payload?: Record<string, unknown> }) => sendTransition(qc, vars),
    onSuccess: ({ queued }, vars) => {
      if (queued) return toast.info(QUEUED_MESSAGE)
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
    networkMode: 'always',
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
      sendTransition(qc, {
        id,
        event: 'complete',
        payload: { work_order: { completion_notes, actual_hours, resolution_type } },
      }),
    onSuccess: ({ queued }, vars) => {
      if (queued) return toast.info(QUEUED_MESSAGE)
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

/** The comments, with the ones written offline and not sent yet shown at the end, marked as waiting. */
export function useWorkOrderComments(id: number) {
  const query = useQuery({
    queryKey: WO_COMMENTS_KEY(id),
    queryFn: () => workOrdersApi.listComments(id).then((r) => r.data.comments),
    enabled: !!id,
  })
  const pending = usePendingActions(id)
  const me = useAuthStore((s) => s.user)
  const data = useMemo(() => {
    if (!query.data || !me) return query.data
    const waiting: WorkOrderComment[] = pending.flatMap((a) =>
      a.type === 'comment'
        ? [{
            id: -a.queuedAt,
            body: a.body,
            internal: a.internal,
            created_at: new Date(a.queuedAt).toISOString(),
            user: { id: me.id, full_name: me.full_name, role: me.role },
            pending: true,
          }]
        : [],
    )
    return [...query.data, ...waiting]
  }, [query.data, pending, me])
  return { ...query, data }
}

export function useCreateComment(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ body, internal }: { body: string; internal: boolean }): Promise<{ queued: boolean }> => {
      const clientId = newClientId()
      const keep = () => {
        offlineQueue.enqueue({
          type: 'comment',
          workOrderId,
          body,
          internal,
          clientId,
          label: describe(qc, workOrderId, 'Comment'),
        })
        return { queued: true }
      }
      if (!navigator.onLine && offlineQueue.canQueue()) return keep()
      try {
        await workOrdersApi.createComment(workOrderId, body, internal, clientId)
        return { queued: false }
      } catch (error) {
        if (isNetworkError(error) && offlineQueue.canQueue()) return keep()
        throw error
      }
    },
    onSuccess: ({ queued }) => {
      if (queued) return toast.info(QUEUED_MESSAGE)
      qc.invalidateQueries({ queryKey: WO_COMMENTS_KEY(workOrderId) })
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Failed to post comment.'),
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

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * Uploads a photo or document. With no connection it is kept on the device, in the queue, and sent
 * later; photos are shrunk first so they are quick to send and small to keep.
 */
export function useUploadAttachment(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: async (original: File): Promise<{ queued: boolean }> => {
      const file = await prepareUpload(original)
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${original.name} is over the 10 MB limit.`)

      const clientId = newClientId()
      const keep = async () => {
        const fileKey = `photo-${clientId}`
        try {
          await fileStore.put(fileKey, file)
        } catch {
          throw new Error('Could not keep the file on this device. Try again when you are online.')
        }
        offlineQueue.enqueue({
          type: 'photo',
          workOrderId,
          fileKey,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          clientId,
          label: describe(qc, workOrderId, `Photo "${file.name}"`),
        })
        return { queued: true }
      }

      if (!navigator.onLine && offlineQueue.canQueue()) return keep()
      try {
        await workOrdersApi.uploadAttachment(workOrderId, file, clientId)
        return { queued: false }
      } catch (error) {
        if (isNetworkError(error) && offlineQueue.canQueue()) return keep()
        throw error
      }
    },
    onSuccess: ({ queued }) => {
      if (queued) return toast.info(QUEUED_MESSAGE)
      qc.invalidateQueries({ queryKey: WO_ATTACHMENTS_KEY(workOrderId) })
    },
    onError: (error: AxiosError<{ error?: { message?: string } }> | Error) =>
      toast.error(('response' in error && error.response?.data?.error?.message) || error.message || 'Failed to upload the file.'),
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
      qc.invalidateQueries({ queryKey: ['parts'] })
      toast.success('Parts logged.')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Failed to log parts.'),
  })
}

export function useRemovePart(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lineId: number) => workOrdersApi.removePart(workOrderId, lineId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_PARTS_KEY(workOrderId) })
      qc.invalidateQueries({ queryKey: [...WO_KEY, workOrderId] })
      qc.invalidateQueries({ queryKey: ['parts'] })
      toast.success('Part removed and put back in stock.')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Failed to remove the part.'),
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
