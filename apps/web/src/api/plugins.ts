import { apiClient } from './client'
import { filenameFrom, type ReportFile } from './reports'

/** One thing an administrator fills in to set up a notification channel. The Plugins screen is drawn from these. */
export interface PluginField {
  key: string
  label: string
  kind: 'text' | 'url' | 'secret' | 'select'
  required: boolean
  help: string
  default: string | null
  options: string[]
}

/** A place a plugin sends notifications, and how this company has set it up. A secret is never sent back: only whether it is set. */
export interface PluginChannel {
  key: string
  title: string
  summary: string
  fields: PluginField[]
  enabled: boolean
  events: string[]
  values: Record<string, string>
  secrets_set: Record<string, boolean>
  last_sent_at: string | null
  /** Why the last message did not get through, in words. */
  last_error: string | null
}

export interface PluginReportInfo {
  key: string
  title: string
  description: string
}

export interface Plugin {
  key: string
  title: string
  version: string | null
  summary: string | null
  author: string | null
  /** The folder it was installed in, under the server's plugins folder. */
  folder: string | null
  /** Switched on for this company by an administrator. */
  enabled: boolean
  reports: PluginReportInfo[]
  channels: PluginChannel[]
}

export interface PluginFailure {
  folder: string
  message: string
}

export interface PluginList {
  plugins: Plugin[]
  /** Plugin folders that did not load, and why. */
  failures: PluginFailure[]
  api_version: number
  available_events: { key: string; label: string }[]
}

export interface ChannelForm {
  enabled: boolean
  events: string[]
  /** A blank secret keeps the saved one. */
  values: Record<string, string>
}

export const pluginsApi = {
  list: () => apiClient.get<PluginList>('/plugins').then((r) => r.data),
  setEnabled: (key: string, enabled: boolean) =>
    apiClient.patch<{ plugin: Plugin }>(`/plugins/${key}`, { plugin: { enabled } }).then((r) => r.data),
  saveChannel: (key: string, channel: string, form: ChannelForm) =>
    apiClient.put<{ plugin: Plugin }>(`/plugins/${key}/channels/${channel}`, { channel: form }).then((r) => r.data),
  removeChannel: (key: string, channel: string) =>
    apiClient.delete<{ plugin: Plugin }>(`/plugins/${key}/channels/${channel}`).then((r) => r.data),
  /** Sends a message through the channel with the values given (over the saved ones), without saving them. */
  testChannel: (key: string, channel: string, values: Record<string, string>) =>
    apiClient.post<{ success: boolean; message: string }>(`/plugins/${key}/channels/${channel}/test`, { channel: { values } }).then((r) => r.data),
}

/** A report a plugin adds, as listed on the Reports page. */
export interface PluginReportEntry {
  plugin: string
  plugin_title: string
  key: string
  title: string
  description: string
  /** Whether the report takes a period. Without one it is as of now. */
  period: boolean
}

export type PluginColumnKind = 'text' | 'number' | 'money' | 'percent' | 'date' | 'datetime'

export interface PluginTable {
  columns: { key: string; label: string; kind: PluginColumnKind }[]
  rows: (string | number | null)[][]
  summary: { label: string; kind: PluginColumnKind; value: string | number | null }[]
  note: string | null
}

export interface PluginReportResult {
  report: PluginReportEntry
  from: string | null
  to: string | null
  table: PluginTable
}

export const pluginReportsApi = {
  list: () => apiClient.get<{ reports: PluginReportEntry[] }>('/plugin_reports').then((r) => r.data.reports),
  get: (plugin: string, report: string, params?: Record<string, unknown>) =>
    apiClient.get<PluginReportResult>(`/plugin_reports/${plugin}/${report}`, { params }).then((r) => r.data),
  download: async (plugin: string, report: string, params?: Record<string, unknown>): Promise<ReportFile> => {
    const res = await apiClient.get<Blob>(`/plugin_reports/${plugin}/${report}.csv`, { params, responseType: 'blob' })
    return {
      blob: res.data,
      filename: filenameFrom(res.headers['content-disposition']) ?? `${plugin}_${report}.csv`,
      truncated: false,
    }
  },
}
