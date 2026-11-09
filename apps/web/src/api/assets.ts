import { apiClient } from './client'
import type { Asset } from '@/types'
import type { LabelFilters, LabelList, LookupMatch } from '@/types/scanning'

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

  /** Which asset a scanned or typed code belongs to: none, one or several. */
  lookup: (code: string) => apiClient.get<{ matches: LookupMatch[] }>('/assets/lookup', { params: { code } }),

  /** What a sheet of labels needs, for up to 500 assets (managers). */
  labels: (filters: LabelFilters) => apiClient.get<LabelList>('/assets/labels', { params: filters }),
}
