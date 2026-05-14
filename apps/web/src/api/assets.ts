import { apiClient } from './client'
import type { Asset } from '@/types'

export const assetsApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ assets: Asset[]; meta: unknown }>('/assets', { params }),

  get: (id: number) =>
    apiClient.get<{ data: Asset }>(`/assets/${id}`),

  create: (data: Partial<Asset>) =>
    apiClient.post<{ data: Asset }>('/assets', { asset: data }),

  update: (id: number, data: Partial<Asset>) =>
    apiClient.patch<{ data: Asset }>(`/assets/${id}`, { asset: data }),

  destroy: (id: number) => apiClient.delete(`/assets/${id}`),
}
