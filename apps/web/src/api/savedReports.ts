import { apiClient } from './client'
import type { EligibleRecipient, SavedReport, SavedReportFilters, SavedReportKind, SavedReportPeriod } from '@/types/savedReports'

export interface SavedReportInput {
  name: string
  report: SavedReportKind
  period: SavedReportPeriod
  filters: SavedReportFilters
  send_on: number | null
  recipient_ids: number[]
}

export const savedReportsApi = {
  list: (report?: SavedReportKind) =>
    apiClient.get<{ saved_reports: SavedReport[]; eligible_recipients: EligibleRecipient[] }>('/saved_reports', {
      params: report ? { report } : undefined,
    }),
  create: (saved_report: SavedReportInput) => apiClient.post<{ data: SavedReport }>('/saved_reports', { saved_report }),
  update: (id: number, saved_report: Partial<Omit<SavedReportInput, 'report'>>) =>
    apiClient.patch<{ data: SavedReport }>(`/saved_reports/${id}`, { saved_report }),
  remove: (id: number) => apiClient.delete(`/saved_reports/${id}`),
  /** Emails the PDF to the person asking, as a test. */
  sendNow: (id: number) => apiClient.post<{ sent_to: string }>(`/saved_reports/${id}/send_now`),
}
