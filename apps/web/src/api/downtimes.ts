import { apiClient } from './client'
import type { Downtime } from '@/types'

export interface DowntimeInput {
  /** When it stopped (a moment, ISO 8601); now if left out. */
  started_at?: string
  /** When it ran again; leave out if it is down now. */
  ended_at?: string
  reason?: string | null
}

export const downtimesApi = {
  list: (assetId: number) => apiClient.get<{ downtimes: Downtime[] }>(`/assets/${assetId}/downtimes`),

  create: (assetId: number, data: DowntimeInput) =>
    apiClient.post<{ data: Downtime }>(`/assets/${assetId}/downtimes`, { downtime: data }),

  update: (id: number, data: DowntimeInput) => apiClient.patch<{ data: Downtime }>(`/downtimes/${id}`, { downtime: data }),

  /** It runs again: now, or at `endedAt`. */
  restart: (id: number, endedAt?: string) => apiClient.post<{ data: Downtime }>(`/downtimes/${id}/restart`, { ended_at: endedAt }),

  destroy: (id: number) => apiClient.delete(`/downtimes/${id}`),
}
