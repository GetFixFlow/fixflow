import { apiClient } from './client'

export interface PushDevice {
  id: number
  endpoint: string
  device: string | null
  created_at: string
  last_sent_at: string | null
}

/** The browser's own description of a subscription: what PushSubscription.toJSON() gives. */
export interface PushSubscriptionJson {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export const pushApi = {
  /** The server's public key (what a browser subscribes against) and this person's devices. */
  list: () => apiClient.get<{ public_key: string; subscriptions: PushDevice[] }>('/push_subscriptions'),
  subscribe: (subscription: PushSubscriptionJson) =>
    apiClient.post<{ subscription: PushDevice }>('/push_subscriptions', { subscription }),
  unsubscribe: (endpoint: string) => apiClient.delete('/push_subscriptions', { params: { endpoint } }),
  test: () => apiClient.post<{ sent: number; removed: number; failed: number }>('/push_subscriptions/test'),
}
