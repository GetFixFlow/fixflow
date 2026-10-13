import { apiClient } from './client'
import type { Part } from '@/types'

export const partsApi = {
  list: (params?: { search?: string }) =>
    apiClient.get<{ parts: Part[]; meta: unknown }>('/parts', { params }),
}
