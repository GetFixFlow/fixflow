import { apiClient } from './client'

export type ImportKind = 'assets' | 'locations' | 'parts'

export interface ImportProblem {
  /** The spreadsheet's row number: row 1 is the headings. */
  row: number
  column: string
  message: string
}

export interface ImportReport {
  kind: ImportKind
  total_rows: number
  error_count: number
  errors: ImportProblem[]
  errors_truncated: boolean
  columns: { known: string[]; custom: string[] }
  preview: Record<string, string>[]
  created: number
}

const form = (file: File) => {
  const body = new FormData()
  body.append('file', file)
  return body
}

export const importsApi = {
  /** The CSV to fill in, as text. */
  template: (kind: ImportKind) => apiClient.get<string>(`/imports/${kind}/template`, { responseType: 'text' }),
  /** What the file would do, changing nothing. */
  preview: (kind: ImportKind, file: File) => apiClient.post<ImportReport>(`/imports/${kind}/preview`, form(file)),
  /** Does it: everything in the file, or nothing if any row has a problem (answered with 422 and the report). */
  commit: (kind: ImportKind, file: File) => apiClient.post<ImportReport>(`/imports/${kind}`, form(file)),
}
