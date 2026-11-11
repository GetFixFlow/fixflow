import { apiClient } from './client'

/** A place FixFlow sends a message when something happens. The secret that signs the messages is never part of this. */
export interface Webhook {
  id: number
  name: string
  url: string
  events: string[]
  /** Switched on by an administrator. */
  active: boolean
  /** On, and not switched off by FixFlow for failing. */
  enabled: boolean
  consecutive_failures: number
  disabled_at: string | null
  /** Why FixFlow switched it off, in words. */
  disabled_reason: string | null
  last_delivery_at: string | null
  created_at: string
}

export interface WebhookEventOption {
  key: string
  label: string
}

export type DeliveryStatus = 'pending' | 'delivered' | 'failed'

/** One message to one webhook, and what happened to it. */
export interface WebhookDelivery {
  id: number
  webhook_id: number
  event: string
  event_id: string
  status: DeliveryStatus
  attempts: number
  response_code: number | null
  response_excerpt: string | null
  /** What went wrong, in words. */
  error: string | null
  next_attempt_at: string | null
  delivered_at: string | null
  created_at: string
}

export interface WebhookForm {
  name: string
  url: string
  events: string[]
  active?: boolean
}

export const webhooksApi = {
  list: () => apiClient.get<{ webhooks: Webhook[]; events: WebhookEventOption[] }>('/webhooks').then((r) => r.data),
  get: (id: number) => apiClient.get<{ webhook: Webhook; deliveries: WebhookDelivery[] }>(`/webhooks/${id}`).then((r) => r.data),
  /** The secret comes back once, here, and is not kept anywhere the screen can read it again. */
  create: (webhook: WebhookForm) => apiClient.post<{ webhook: Webhook; secret: string }>('/webhooks', { webhook }).then((r) => r.data),
  update: (id: number, webhook: Partial<WebhookForm>) => apiClient.patch<{ webhook: Webhook }>(`/webhooks/${id}`, { webhook }).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/webhooks/${id}`),
  /** A new secret, shown once; the old one stops signing at once. */
  rotateSecret: (id: number) => apiClient.post<{ webhook: Webhook; secret: string }>(`/webhooks/${id}/rotate_secret`).then((r) => r.data),
  /** Switch on again after FixFlow switched it off for failing. */
  enable: (id: number) => apiClient.post<{ webhook: Webhook }>(`/webhooks/${id}/enable`).then((r) => r.data),
  /** Sends a test message now and answers with what the receiver said. */
  test: (id: number) => apiClient.post<{ delivery: WebhookDelivery }>(`/webhooks/${id}/test`).then((r) => r.data),
  redeliver: (deliveryId: number) =>
    apiClient.post<{ delivery: WebhookDelivery }>(`/webhooks/deliveries/${deliveryId}/redeliver`).then((r) => r.data),
}
