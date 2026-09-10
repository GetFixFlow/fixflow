import { apiClient } from './client'
import type {
  IotAlert,
  IotRule,
  SensorReading,
  IotRuleExtended,
  IotAlertExtended,
  IoTDashboardStats,
  ApiKeyFull,
  ApiKeyWithSecret,
  ApiKeyCreateRequest,
} from '@/types'

export const iotApi = {
  alerts: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get<{ iot_alerts: IotAlert[]; meta: unknown }>('/iot_alerts', { params }),

    get: (id: number) =>
      apiClient.get<{ data: IotAlertExtended }>(`/iot_alerts/${id}`),

    acknowledge: (id: number) =>
      apiClient.patch<{ data: IotAlert }>(`/iot_alerts/${id}/acknowledge`),

    resolve: (id: number) =>
      apiClient.patch<{ data: IotAlert }>(`/iot_alerts/${id}/resolve`),

    suppress: (id: number) =>
      apiClient.patch<{ data: IotAlertExtended }>(`/iot_alerts/${id}/suppress`),

    bulkAcknowledge: (ids: number[]) =>
      apiClient.patch('/iot_alerts/bulk_acknowledge', { ids }),

    bulkResolve: (ids: number[]) =>
      apiClient.patch('/iot_alerts/bulk_resolve', { ids }),

    history: (assetId: number, params?: Record<string, unknown>) =>
      apiClient.get<{ iot_alerts: IotAlertExtended[] }>(`/assets/${assetId}/iot_alerts`, { params }),
  },

  rules: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get<{ iot_rules: IotRule[]; meta: unknown }>('/iot_rules', { params }),

    get: (id: number) =>
      apiClient.get<{ data: IotRuleExtended }>(`/iot_rules/${id}`),

    create: (data: Partial<IotRule>) =>
      apiClient.post<{ data: IotRule }>('/iot_rules', { iot_rule: data }),

    update: (id: number, data: Partial<IotRule>) =>
      apiClient.patch<{ data: IotRule }>(`/iot_rules/${id}`, { iot_rule: data }),

    destroy: (id: number) => apiClient.delete(`/iot_rules/${id}`),

    pause: (id: number) =>
      apiClient.patch<{ data: IotRuleExtended }>(`/iot_rules/${id}/pause`),

    resume: (id: number) =>
      apiClient.patch<{ data: IotRuleExtended }>(`/iot_rules/${id}/resume`),

    archive: (id: number) =>
      apiClient.patch<{ data: IotRuleExtended }>(`/iot_rules/${id}/archive`),

    duplicate: (id: number) =>
      apiClient.post<{ data: IotRuleExtended }>(`/iot_rules/${id}/duplicate`),

    test: (id: number, value: number) =>
      apiClient.post<{
        would_trigger: boolean
        reason: string
        recent_readings: { value: number; unit: string; recorded_at: string; would_trigger: boolean }[]
      }>(`/iot_rules/${id}/test`, { test_value: value }),
  },

  readings: {
    list: (assetId: number, params?: Record<string, unknown>) =>
      apiClient.get<{ sensor_readings: SensorReading[] }>(`/assets/${assetId}/sensor_readings`, {
        params,
      }),

    activity: (params?: Record<string, unknown>) =>
      apiClient.get<{ hourly: { hour: string; count: number }[] }>('/iot_readings/activity', { params }),
  },

  alertSummary: () => apiClient.get('/reports/iot/alert_summary'),

  sensorTrends: (params?: Record<string, unknown>) =>
    apiClient.get('/reports/iot/sensor_trends', { params }),

  dashboard: () => apiClient.get<IoTDashboardStats>('/reports/iot/dashboard'),

  apiKeys: {
    list: () => apiClient.get<{ api_keys: ApiKeyFull[] }>('/api_keys'),

    create: (data: ApiKeyCreateRequest) =>
      apiClient.post<{ data: ApiKeyWithSecret }>('/api_keys', { api_key: data }),

    revoke: (id: number) => apiClient.delete(`/api_keys/${id}`),
  },
}
