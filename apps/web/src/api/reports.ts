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
