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

  /**
   * A report as a file: the same address and parameters as the screen's own request, with .csv or .pdf on
   * the end, so the file holds what the screen shows.
   */
  download: async (path: string, format: ReportFormat, params?: Record<string, unknown>): Promise<ReportFile> => {
    const res = await apiClient.get<Blob>(`/reports/${path}.${format}`, { params, responseType: 'blob' })
    return {
      blob: res.data,
      filename: filenameFrom(res.headers['content-disposition']) ?? `${path.replace(/\//g, '_')}.${format}`,
      truncated: res.headers['x-export-truncated'] === 'true',
    }
  },
}

export type ReportFormat = 'csv' | 'pdf'

export interface ReportFile {
  blob: Blob
  filename: string
  /** The server stopped at its row limit: the file is not everything. */
  truncated: boolean
}

function filenameFrom(disposition: unknown): string | undefined {
  return typeof disposition === 'string' ? /filename="?([^";]+)"?/i.exec(disposition)?.[1] : undefined
}
