import { apiClient } from './client'
import { filenameFrom, type ReportFile } from './reports'

export interface AuditLine {
  id: number
  /** "asset.created", "work_order.completed", "user.signed_in"... */
  action: string
  resource_type: string | null
  resource_id: number | null
  resource_name: string | null
  ip_address: string | null
  created_at: string
  /** `changed` names the fields that changed (never their values), `values` the few that are written down (a role). */
  metadata: {
    changed?: string[]
    values?: Record<string, unknown[]>
    changes?: Record<string, unknown[]>
    device?: string
    [key: string]: unknown
  }
  /** Empty when the system did it (a job, a public request). */
  user: { id: number; full_name: string; email: string } | null
}

export interface AuditFilters {
  person?: string
  resource_type?: string
  verb?: string
  q?: string
  from?: string
  to?: string
}

export interface AuditPage {
  activity_logs: AuditLine[]
  meta: { pagination: { current_page: number; total_pages: number; total_count: number; per_page: number } }
}

/** The audit log (managers and administrators; the screen is the administrator's). */
export const auditApi = {
  list: (filters: AuditFilters, page: number) =>
    apiClient.get<AuditPage>('/activity_logs', { params: { ...clean(filters), page } }).then((r) => r.data),

  /** The same list as a spreadsheet, with the same filters (at most 50,000 lines; `truncated` says if it was cut). */
  download: async (filters: AuditFilters): Promise<ReportFile> => {
    const res = await apiClient.get<Blob>('/activity_logs.csv', { params: clean(filters), responseType: 'blob' })
    return {
      blob: res.data,
      filename: filenameFrom(res.headers['content-disposition']) ?? 'audit_log.csv',
      truncated: res.headers['x-export-truncated'] === 'true',
    }
  },
}

function clean(filters: AuditFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => typeof value === 'string' && value.trim() !== '')) as Record<string, string>
}
