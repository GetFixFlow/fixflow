import { differenceInCalendarDays } from 'date-fns'
import { apiClient } from './client'
import type { PreventiveMaintenance, PmExecution, PMDashboardStats, PMForecastItem, PMSchedulePreviewItem, PMFilters } from '@/types'

export const pmApi = {
  list: (params?: Partial<PMFilters>) =>
    apiClient.get<{ pm_schedules: PreventiveMaintenance[]; meta: unknown }>(
      '/preventive_maintenances', { params }),

  get: (id: number) =>
    apiClient.get<{ data: PreventiveMaintenance; executions: PmExecution[] }>(`/preventive_maintenances/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post<{ data: PreventiveMaintenance }>('/preventive_maintenances', { preventive_maintenance: data }),

  update: (id: number, data: Record<string, unknown>) =>
    apiClient.patch<{ data: PreventiveMaintenance }>(`/preventive_maintenances/${id}`, { preventive_maintenance: data }),

  destroy: (id: number) => apiClient.delete(`/preventive_maintenances/${id}`),

  trigger: (id: number, overrides?: Record<string, unknown>) =>
    apiClient.patch<{ message: string; work_order: { id: number; work_order_number: string } }>(
      `/preventive_maintenances/${id}/trigger`, { overrides }),

  pause: (id: number) =>
    apiClient.patch<{ data: PreventiveMaintenance }>(`/preventive_maintenances/${id}/pause`),

  resume: (id: number) =>
    apiClient.patch<{ data: PreventiveMaintenance }>(`/preventive_maintenances/${id}/resume`),

  executions: (id: number, params?: Record<string, unknown>) =>
    apiClient.get<{ executions: PmExecution[]; meta: unknown }>(`/preventive_maintenances/${id}/executions`, { params }),

  skipExecution: (pmId: number, executionId: number, reason: string) =>
    apiClient.patch<{ data: PmExecution }>(`/preventive_maintenances/${pmId}/executions/${executionId}/skip`, { skip_reason: reason }),

  // The API returns plain dates; the screens also want how far away each is and which occurrence it is.
  previewSchedule: (id: number) =>
    apiClient
      .get<{ scheduled_dates: string[] }>(`/preventive_maintenances/${id}/preview`)
      .then((r) => ({
        data: {
          items: r.data.scheduled_dates.map<PMSchedulePreviewItem>((date, index) => ({
            date,
            days_until: differenceInCalendarDays(new Date(date), new Date()),
            occurrence: index + 1,
          })),
        },
      })),

  dashboard: (params?: { date_range?: number }) =>
    apiClient.get<PMDashboardStats>('/preventive_maintenances/dashboard', { params }),

  // The API groups the forecast by week; the timeline wants one flat list.
  forecast: (days?: number) =>
    apiClient
      .get<{ by_week: { pms: { pm_id: number; name: string; asset: string; due_date: string; priority: PMForecastItem['priority']; estimated_hours: number }[] }[] }>(
        '/reports/pm/schedule_forecast', { params: { days: days ?? 30 } })
      .then((r) => ({
        data: {
          items: r.data.by_week.flatMap((week) =>
            week.pms.map<PMForecastItem>((pm) => ({
              pm_id: pm.pm_id, pm_name: pm.name, asset_name: pm.asset, due_date: pm.due_date,
              priority: pm.priority, estimated_hours: pm.estimated_hours,
            })),
          ),
        },
      })),

  compliance: (params?: Record<string, unknown>) =>
    apiClient.get('/reports/pm/compliance', { params }),
}
