import { apiClient } from './client'
import type { PreventiveMaintenance, PmExecution } from '@/types'

export const pmApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get<{ preventive_maintenances: PreventiveMaintenance[]; meta: unknown }>(
      '/preventive_maintenances',
      { params },
    ),

  get: (id: number) =>
    apiClient.get<{ data: PreventiveMaintenance }>(`/preventive_maintenances/${id}`),

  create: (data: Partial<PreventiveMaintenance>) =>
    apiClient.post<{ data: PreventiveMaintenance }>('/preventive_maintenances', {
      preventive_maintenance: data,
    }),

  update: (id: number, data: Partial<PreventiveMaintenance>) =>
    apiClient.patch<{ data: PreventiveMaintenance }>(`/preventive_maintenances/${id}`, {
      preventive_maintenance: data,
    }),

  destroy: (id: number) => apiClient.delete(`/preventive_maintenances/${id}`),

  execute: (id: number, notes?: string) =>
    apiClient.post<{ data: PmExecution }>(`/preventive_maintenances/${id}/execute`, { notes }),

  compliance: (params?: Record<string, unknown>) =>
    apiClient.get('/reports/pm/compliance', { params }),

  forecast: () => apiClient.get('/reports/pm/schedule_forecast'),
}
