import { apiClient } from './client'
import type { Part } from '@/types'

export interface PartsMeta {
  current_page: number
  total_pages: number
  total_count: number
  per_page: number
}

export interface PartInput {
  name: string
  sku: string
  reorder_point: number
  unit: string
  unit_cost: number | null
  /** Only used when adding a part; afterwards stock changes go through adjustStock. */
  quantity_on_hand?: number
}

export const partsApi = {
  list: (params?: { search?: string; low_stock?: boolean; page?: number }) =>
    apiClient.get<{ parts: Part[]; meta: PartsMeta }>('/parts', { params }),
  create: (part: PartInput) => apiClient.post<Part>('/parts', { part }),
  update: (id: number, part: Omit<PartInput, 'quantity_on_hand'>) => apiClient.patch<Part>(`/parts/${id}`, { part }),
  remove: (id: number) => apiClient.delete(`/parts/${id}`),
  adjustStock: (id: number, body: { quantity: number; direction: 'add' | 'remove'; reason?: string }) =>
    apiClient.patch<Part>(`/parts/${id}/adjust_stock`, body),
}
