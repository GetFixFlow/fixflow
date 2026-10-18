import { apiClient } from './client'
import { filenameFrom, type ReportFile } from './reports'

export interface Backup {
  /** "fixflow_20261018_030000.sql.gz": the day and time (UTC) it was made. */
  name: string
  bytes: number
  created_at: string
}

/** The database backups in the file storage, newest first (administrators only). */
export interface BackupList {
  bucket: string
  backups: Backup[]
  /** The newest backup is older than a nightly backup should allow (only on a server that makes them). */
  overdue: boolean
  /** Set when the file storage did not answer; `backups` is then empty and says nothing about what exists. */
  error: string | null
}

export const backupsApi = {
  list: () => apiClient.get<BackupList>('/backups').then((r) => r.data),

  /** The backup file itself. It holds all of the company's data, password hashes included. */
  download: async (name: string): Promise<ReportFile> => {
    const res = await apiClient.get<Blob>(`/backups/${name}/download`, { responseType: 'blob' })
    return { blob: res.data, filename: filenameFrom(res.headers['content-disposition']) ?? name, truncated: false }
  },
}
