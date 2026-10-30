import { apiClient } from './client'

export type ChatKind = 'slack' | 'teams'

/** What an administrator sees. The webhook address is a secret: only the name of its host comes back. */
export interface ChatSettings {
  kind: ChatKind
  enabled: boolean
  events: string[]
  url_set: boolean
  url_hint: string | null
  last_sent_at: string | null
  /** Why the last message did not get through, in words. */
  last_error: string | null
  available_events: { key: string; label: string }[]
}

export interface ChatForm {
  kind: ChatKind
  enabled: boolean
  events: string[]
  /** Blank keeps the address already saved. */
  url: string
}

export const chatApi = {
  get: () => apiClient.get<{ chat: ChatSettings }>('/chat_settings'),
  update: (chat: ChatForm) => apiClient.patch<{ chat: ChatSettings }>('/chat_settings', { chat }),
  remove: () => apiClient.delete<{ chat: ChatSettings }>('/chat_settings'),
  /** Posts a test message through this address (or the saved one) without saving anything. */
  test: (chat: Pick<ChatForm, 'kind' | 'url'>) => apiClient.post<{ success: boolean; message: string }>('/chat_settings/test', { chat }),
}
