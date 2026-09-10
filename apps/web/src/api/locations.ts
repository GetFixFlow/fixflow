import { apiClient } from './client'
import type { Location } from '@/types'

export const locationsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ locations: Location[]; meta: unknown }>('/locations', { params }),

  get: (id: number) =>
    apiClient.get<{ data: Location }>(`/locations/${id}`),

  create: (data: Partial<Location>) =>
    apiClient.post<{ data: Location }>('/locations', { location: data }),

  update: (id: number, data: Partial<Location>) =>
    apiClient.patch<{ data: Location }>(`/locations/${id}`, { location: data }),

  destroy: (id: number) => apiClient.delete(`/locations/${id}`),
}
