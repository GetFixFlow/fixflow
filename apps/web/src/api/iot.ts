import { apiClient } from './client'
import type { IotAlert, IotRule, SensorReading } from '@/types'

export const iotApi = {
  alerts: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get<{ iot_alerts: IotAlert[]; meta: unknown }>('/iot_alerts', { params }),

    acknowledge: (id: number) =>
      apiClient.patch<{ data: IotAlert }>(`/iot_alerts/${id}/acknowledge`),

    resolve: (id: number) =>
      apiClient.patch<{ data: IotAlert }>(`/iot_alerts/${id}/resolve`),
  },

  rules: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get<{ iot_rules: IotRule[]; meta: unknown }>('/iot_rules', { params }),

    create: (data: Partial<IotRule>) =>
      apiClient.post<{ data: IotRule }>('/iot_rules', { iot_rule: data }),

    update: (id: number, data: Partial<IotRule>) =>
      apiClient.patch<{ data: IotRule }>(`/iot_rules/${id}`, { iot_rule: data }),

    destroy: (id: number) => apiClient.delete(`/iot_rules/${id}`),
  },

  readings: {
    list: (assetId: number, params?: Record<string, unknown>) =>
      apiClient.get<{ sensor_readings: SensorReading[] }>(`/assets/${assetId}/sensor_readings`, {
        params,
      }),
  },

  alertSummary: () => apiClient.get('/reports/iot/alert_summary'),

  sensorTrends: (params?: Record<string, unknown>) =>
    apiClient.get('/reports/iot/sensor_trends', { params }),
}
