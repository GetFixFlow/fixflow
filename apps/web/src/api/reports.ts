import { apiClient } from './client'

export const reportsApi = {
  dashboard: () => apiClient.get('/dashboard'),

  workOrders: {
    summary: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/work_orders/summary', { params }),
    mttr: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/work_orders/mttr', { params }),
    backlog: () => apiClient.get('/reports/work_orders/backlog'),
    technicianPerformance: () =>
      apiClient.get('/reports/work_orders/technician_performance'),
  },

  assets: {
    health: () => apiClient.get('/reports/assets/health'),
    history: (id: number) => apiClient.get(`/reports/assets/${id}/history`),
    costAnalysis: () => apiClient.get('/reports/assets/cost_analysis'),
  },

  pm: {
    compliance: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/pm/compliance', { params }),
    forecast: () => apiClient.get('/reports/pm/schedule_forecast'),
  },

  iot: {
    alerts: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/iot/alerts', { params }),
    ruleEffectiveness: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/iot/rule_effectiveness', { params }),
  },

  costs: {
    summary: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/costs/summary', { params }),
    byAsset: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/costs/by_asset', { params }),
    byLocation: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/costs/by_location', { params }),
  },

  exportCsv: (type: string, params?: Record<string, unknown>) =>
    apiClient.get(`/reports/${type}/export.csv`, {
      params,
      responseType: 'blob',
    }),

  exportPdf: (type: string, params?: Record<string, unknown>) =>
    apiClient.get(`/reports/${type}/export.pdf`, {
      params,
      responseType: 'blob',
    }),
}
