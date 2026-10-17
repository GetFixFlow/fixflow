import { apiClient } from './client'
import type { SystemHealth } from '@/types/system'

export const systemApi = {
  /** Administrators only: the database, Redis, the background worker, email, MQTT, storage and updates, checked live. */
  health: () => apiClient.get<SystemHealth>('/system_health'),
}
