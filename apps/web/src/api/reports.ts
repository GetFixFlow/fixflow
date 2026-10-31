import { apiClient } from './client'
import type {
  AssetHealth, AssetHistory, BacklogReport, CostByAsset, CostByVendor, CostSummary, DowntimeReport, IotAlertsReport,
  IotRuleEffectiveness, MttrReport, PmCompliance, PmForecast, WorkOrderSummary,
} from '@/types/reports'
import type { TechnicianStats } from '@/components/reports/TechnicianScorecard'

export const reportsApi = {
  dashboard: () => apiClient.get('/dashboard'),

  workOrders: {
    summary: (params?: Record<string, unknown>) =>
      apiClient.get<WorkOrderSummary>('/reports/work_orders/summary', { params }),
    mttr: (params?: Record<string, unknown>) =>
      apiClient.get<MttrReport>('/reports/work_orders/mttr', { params }),
    /** What is open now: the Filters apply, the period does not. */
    backlog: (params?: Record<string, unknown>) =>
      apiClient.get<BacklogReport>('/reports/work_orders/backlog', { params }),
    technicianPerformance: (params?: Record<string, unknown>) =>
      apiClient.get<{ technicians: TechnicianStats[] }>('/reports/work_orders/technician_performance', { params }),
  },

  assets: {
    health: (params?: Record<string, unknown>) =>
      apiClient.get<AssetHealth>('/reports/assets/health', { params }),
    downtime: (params?: Record<string, unknown>) =>
      apiClient.get<DowntimeReport>('/reports/assets/downtime', { params }),
    history: (id: number) => apiClient.get<AssetHistory>(`/reports/assets/${id}/history`),
  },

  pm: {
    compliance: (params?: Record<string, unknown>) =>
      apiClient.get<PmCompliance>('/reports/pm/compliance', { params }),
    forecast: (params?: Record<string, unknown>) =>
      apiClient.get<PmForecast>('/reports/pm/schedule_forecast', { params }),
  },

  iot: {
    alerts: (params?: Record<string, unknown>) =>
      apiClient.get<IotAlertsReport>('/reports/iot/alerts', { params }),
    ruleEffectiveness: (params?: Record<string, unknown>) =>
      apiClient.get<IotRuleEffectiveness>('/reports/iot/rule_effectiveness', { params }),
  },

  costs: {
    summary: (params?: Record<string, unknown>) =>
      apiClient.get<CostSummary>('/reports/costs/summary', { params }),
    byAsset: (params?: Record<string, unknown>) =>
      apiClient.get<CostByAsset>('/reports/costs/by_asset', { params }),
    byLocation: (params?: Record<string, unknown>) =>
      apiClient.get('/reports/costs/by_location', { params }),
    byVendor: (params?: Record<string, unknown>) =>
      apiClient.get<CostByVendor>('/reports/costs/by_vendor', { params }),
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

export function filenameFrom(disposition: unknown): string | undefined {
  return typeof disposition === 'string' ? /filename="?([^";]+)"?/i.exec(disposition)?.[1] : undefined
}
