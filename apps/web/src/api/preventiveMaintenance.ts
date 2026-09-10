import { apiClient } from './client'
import type { PreventiveMaintenance, PmExecution, PMDashboardStats, PMForecastItem, PMSchedulePreviewItem, PMFilters } from '@/types'

export const pmApi = {
  list: (params?: Partial<PMFilters>) =>
    apiClient.get<{ preventive_maintenances: PreventiveMaintenance[]; meta: unknown }>(
      '/preventive_maintenances', { params }),

  get: (id: number) =>
    apiClient.get<{ data: PreventiveMaintenance; executions: PmExecution[] }>(`/preventive_maintenances/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: PreventiveMaintenance }>('/preventive_maintenances', { preventive_maintenance: data }),

  update: (id: number, data: Record<string, unknown>) =>
    apiClient.patch<{ data: PreventiveMaintenance }>(`/preventive_maintenances/${id}`, { preventive_maintenance: data }),

  destroy: (id: number) => apiClient.delete(`/preventive_maintenances/${id}`),

  trigger: (id: number, overrides?: Record<string, unknown>) =>
    apiClient.post<{ data: { work_order_number: string; work_order_id: number } }>(
      `/preventive_maintenances/${id}/trigger`, { overrides }),

  pause: (id: number) =>
    apiClient.patch<{ data: PreventiveMaintenance }>(`/preventive_maintenances/${id}/pause`),

  resume: (id: number) =>
    apiClient.patch<{ data: PreventiveMaintenance }>(`/preventive_maintenances/${id}/resume`),

  executions: (id: number, params?: Record<string, unknown>) =>
    apiClient.get<{ executions: PmExecution[]; meta: unknown }>(`/preventive_maintenances/${id}/executions`, { params }),

  skipExecution: (pmId: number, executionId: number, reason: string) =>
    apiClient.patch<{ data: PmExecution }>(`/preventive_maintenances/${pmId}/executions/${executionId}/skip`, { reason }),

  previewSchedule: (id: number, count?: number) =>
    apiClient.get<{ items: PMSchedulePreviewItem[] }>(`/preventive_maintenances/${id}/preview_schedule`, { params: { count: count ?? 12 } }),

  dashboard: (params?: { date_range?: number }) =>
    apiClient.get<PMDashboardStats>('/reports/pm/dashboard', { params }),

  forecast: (days?: number) =>
    apiClient.get<{ items: PMForecastItem[] }>('/reports/pm/forecast', { params: { days: days ?? 30 } }),

  compliance: (params?: Record<string, unknown>) =>
    apiClient.get('/reports/pm/compliance', { params }),
}
