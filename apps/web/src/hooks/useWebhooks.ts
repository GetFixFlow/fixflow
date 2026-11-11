import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { webhooksApi, type WebhookForm } from '@/api/webhooks'
import { t } from '@/i18n'

function failure(fallbackKey: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? t(fallbackKey))
}

export function useWebhooks() {
  return useQuery({ queryKey: ['webhooks'], queryFn: webhooksApi.list })
}

/** One webhook with its latest messages. `refetchInterval` keeps an open log fresh while messages are still being retried. */
export function useWebhook(id: number | null) {
  return useQuery({ queryKey: ['webhooks', id], queryFn: () => webhooksApi.get(id as number), enabled: id != null })
}

export function useCreateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (webhook: WebhookForm) => webhooksApi.create(webhook),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: failure('webhooks.toast.save_failed'),
  })
}

export function useUpdateWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...webhook }: { id: number } & Partial<WebhookForm>) => webhooksApi.update(id, webhook),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success(t('webhooks.toast.saved'))
    },
    onError: failure('webhooks.toast.save_failed'),
  })
}

export function useRemoveWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => webhooksApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success(t('webhooks.toast.removed'))
    },
    onError: failure('webhooks.toast.remove_failed'),
  })
}

export function useRotateWebhookSecret() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => webhooksApi.rotateSecret(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: failure('webhooks.toast.rotate_failed'),
  })
}

export function useEnableWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => webhooksApi.enable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success(t('webhooks.toast.enabled'))
    },
    onError: failure('webhooks.toast.enable_failed'),
  })
}

/** The page shows the outcome next to the button, so no toast for the result; only the log is refreshed. */
export function useTestWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => webhooksApi.test(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })
}

export function useRedeliverWebhook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deliveryId: number) => webhooksApi.redeliver(deliveryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success(t('webhooks.toast.redelivered'))
    },
    onError: failure('webhooks.toast.redeliver_failed'),
  })
}
