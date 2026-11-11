import { t } from '@/i18n'
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
import type { WorkOrder, WorkOrderComment } from '@/types'

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
      toast.success(t('workOrders.toast.created', { number: res.data.data.work_order_number }))
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.create_failed')),
  })
}

export function useUpdateWorkOrder(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WorkOrder>) => workOrdersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      toast.success(t('workOrders.toast.updated'))
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.update_failed')),
  })
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => workOrdersApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      toast.success(t('workOrders.toast.cancelled'))
    },
    onError: () => toast.error(t('workOrders.toast.cancel_failed')),
  })
}

const queuedMessage = () => t('workOrders.toast.queued')

/** What a queued change is called in messages: "Start work on WO-000012". */
function describe(qc: QueryClient, id: number, what: string) {
  const number = qc.getQueryData<WorkOrder>([...WO_KEY, id])?.work_order_number
  return t('workOrders.toast.what_on', { what, target: number ?? t('workOrders.toast.work_order_n', { id }) })
}

const eventWord = (event: OfflineEvent) => t(`workOrders.toast.event_${event}`)

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
      label: describe(qc, id, eventWord(event as OfflineEvent)),
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
      if (queued) return toast.info(queuedMessage())
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: [...WO_KEY, vars.id] })
      toast.success(t('workOrders.toast.status_updated'))
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.invalid_transition')),
  })
}

/** A manager approves work over the approval limit; the person doing it asks the managers to. */
export function useApproval() {
  const qc = useQueryClient()
  const refresh = (id: number) => {
    qc.invalidateQueries({ queryKey: WO_KEY })
    qc.invalidateQueries({ queryKey: [...WO_KEY, id] })
  }
  const failure = (error: AxiosError<{ error?: { message?: string } }>) =>
    toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.could_not'))
  return {
    approve: useMutation({
      mutationFn: (id: number) => workOrdersApi.approve(id),
      onSuccess: (_, id) => { refresh(id); toast.success(t('workOrders.toast.approved')) },
      onError: failure,
    }),
    request: useMutation({
      mutationFn: (id: number) => workOrdersApi.requestApproval(id),
      onSuccess: (_, id) => { refresh(id); toast.success(t('workOrders.toast.asked')) },
      onError: failure,
    }),
  }
}

export function useAssignWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, assignee_id }: { id: number; assignee_id: number }) =>
      workOrdersApi.update(id, { assignee_id }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: [...WO_KEY, vars.id] })
      toast.success(t('workOrders.toast.assigned'))
    },
    onError: () => toast.error(t('workOrders.toast.assign_failed')),
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
      if (queued) return toast.info(queuedMessage())
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: [...WO_KEY, vars.id] })
      toast.success(t('workOrders.toast.completed'))
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.complete_failed')),
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
      toast.success(t('workOrders.toast.verified'))
    },
    onError: () => toast.error(t('workOrders.toast.verify_failed')),
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
      toast.success(t('workOrders.toast.returned'))
    },
    onError: () => toast.error(t('workOrders.toast.reject_failed')),
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
          label: describe(qc, workOrderId, t('workOrders.toast.comment')),
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
      if (queued) return toast.info(queuedMessage())
      qc.invalidateQueries({ queryKey: WO_COMMENTS_KEY(workOrderId) })
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.comment_failed')),
  })
}

export function useDeleteComment(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: number) => workOrdersApi.deleteComment(workOrderId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: WO_COMMENTS_KEY(workOrderId) }),
    onError: () => toast.error(t('workOrders.toast.comment_delete_failed')),
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
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(t('workOrders.toast.too_big', { name: original.name }))

      const clientId = newClientId()
      const keep = async () => {
        const fileKey = `photo-${clientId}`
        try {
          await fileStore.put(fileKey, file)
        } catch {
          throw new Error(t('workOrders.toast.keep_failed'))
        }
        offlineQueue.enqueue({
          type: 'photo',
          workOrderId,
          fileKey,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          clientId,
          label: describe(qc, workOrderId, t('workOrders.toast.photo', { name: file.name })),
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
      if (queued) return toast.info(queuedMessage())
      qc.invalidateQueries({ queryKey: WO_ATTACHMENTS_KEY(workOrderId) })
    },
    onError: (error: AxiosError<{ error?: { message?: string } }> | Error) =>
      toast.error(('response' in error && error.response?.data?.error?.message) || error.message || t('workOrders.toast.upload_failed')),
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
      toast.success(t('workOrders.toast.parts_logged'))
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.parts_failed')),
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
      toast.success(t('workOrders.toast.part_removed'))
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.part_remove_failed')),
  })
}

// Checklist

/**
 * Ticks or unticks one step. It shows at once (a checkbox that waits for the server feels broken on a
 * phone), and with no connection it is kept on the device and sent later, in order with the rest.
 */
export function useToggleChecklistStep(workOrderId: number) {
  const qc = useQueryClient()
  const key = [...WO_KEY, workOrderId]
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ step, completed }: { step: number; completed: boolean }): Promise<{ queued: boolean }> => {
      const keep = () => {
        offlineQueue.enqueue({ type: 'checklist', workOrderId, step, completed, label: describe(qc, workOrderId, t('workOrders.toast.checklist_step', { step })) })
        return { queued: true }
      }
      if (!navigator.onLine && offlineQueue.canQueue()) return keep()
      try {
        await workOrdersApi.updateChecklist(workOrderId, [{ step, completed }])
        return { queued: false }
      } catch (error) {
        if (isNetworkError(error) && offlineQueue.canQueue()) return keep()
        throw error
      }
    },
    onMutate: async ({ step, completed }) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<WorkOrder>(key)
      if (before?.checklist) {
        qc.setQueryData<WorkOrder>(key, { ...before, checklist: before.checklist.map((i) => (i.step === step ? { ...i, completed } : i)) })
      }
      return { before }
    },
    onSuccess: ({ queued }, _vars, context) => {
      // Waiting changes are drawn from the queue, not the cache, so put the cache back as it was.
      if (queued && context?.before) qc.setQueryData(key, context.before)
      qc.invalidateQueries({ queryKey: key })
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>, _vars, context) => {
      if (context?.before) qc.setQueryData(key, context.before)
      toast.error(error.response?.data?.error?.message ?? t('workOrders.toast.checklist_failed'))
    },
  })
}
