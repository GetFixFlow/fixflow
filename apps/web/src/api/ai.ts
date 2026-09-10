import { apiClient } from './client'

export interface AIConfig {
  enabled: boolean
  model: string
}

export const aiApi = {
  config: {
    get: () => apiClient.get<{ data: AIConfig }>('/ai/config'),
  },
}
