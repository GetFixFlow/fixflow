import { apiClient } from './client'

export interface SampleCounts {
  Location: number
  Asset: number
  Part: number
  PreventiveMaintenance: number
  WorkOrder: number
}

export interface SampleStatus {
  loaded: boolean
  counts: SampleCounts
}

export interface SampleRemoval extends SampleStatus {
  report: {
    removed: Partial<SampleCounts>
    /** Sample records that were kept because something you made depends on them. */
    kept: { type: string; name: string; reason: string }[]
  }
}

export interface GettingStartedStep {
  key: 'assets' | 'work_order' | 'team'
  title: string
  description: string
  done: boolean
  path: string
}

export interface GettingStarted {
  steps: GettingStartedStep[]
  all_done: boolean
  dismissed: boolean
  sample_loaded: boolean
}

export const sampleDataApi = {
  status: () => apiClient.get<SampleStatus>('/sample_data'),
  load: () => apiClient.post<SampleStatus>('/sample_data'),
  remove: () => apiClient.delete<SampleRemoval>('/sample_data'),
}

export const gettingStartedApi = {
  get: () => apiClient.get<GettingStarted>('/getting_started'),
  dismiss: () => apiClient.post<GettingStarted>('/getting_started/dismiss'),
}
