import { apiClient } from './client'

/** AI is off until an administrator picks one. `local` is a model run on the company's own network: nothing leaves it. */
export type AiProvider = 'none' | 'anthropic' | 'openai_compatible' | 'local'
export type AiChoice = Exclude<AiProvider, 'none'>

/** What the AI does, each of which an administrator can switch off. */
export type AiFeature = 'priority' | 'anomalies'
export type AiFeatures = Record<AiFeature, boolean>

export interface AIConfig {
  enabled: boolean
  model: string
  provider: AiProvider
  /** `app` when saved on the settings screen, `environment` when it comes from the server's .env, else none. */
  source: 'app' | 'environment' | null
  /** Which features are on for this company: all off while AI is off. */
  features: AiFeatures
}

/** One provider's own settings. A key is never sent back, only whether one is saved. */
export interface AiProviderSettings {
  model?: string
  default_model?: string
  base_url?: string
  key_set: boolean
}

export interface AiSettings {
  provider: AiProvider
  enabled: boolean
  source: 'app' | 'environment' | null
  /** The host the data goes to (or api.anthropic.com), without anything secret. */
  where: string | null
  /** The server's .env switches Claude on, which is what runs until something is saved. */
  environment_configured: boolean
  /** The switches as saved (a feature is on until switched off), whether or not AI itself is on. */
  features: AiFeatures
  providers: Record<AiChoice, AiProviderSettings>
}

/**
 * The fields of the chosen provider (a blank key keeps the one already saved), or only `features`, which switches those on or
 * off and leaves the provider as it is.
 */
export interface AiForm {
  provider?: AiProvider
  model?: string
  base_url?: string
  api_key?: string
  features?: Partial<AiFeatures>
}

/** A priority for a work order being written, and a short reason. */
export interface PrioritySuggestion {
  priority: 'critical' | 'high' | 'medium' | 'low'
  reason: string
}

/** A sensor reading far outside what that sensor usually reads, flagged without anyone setting a limit. */
export interface SensorAnomaly {
  id: number
  status: 'open' | 'acknowledged' | 'dismissed'
  metric_name: string
  unit: string | null
  value: number
  usual_low: number
  usual_high: number
  usual_middle: number
  /** How many typical deviations from the middle. */
  score: number
  baseline_count: number
  recorded_at: string
  created_at: string
  acknowledged_at: string | null
  notes: string | null
  asset_id: number
  message: string
  asset: { id: number; name: string; asset_tag: string | null }
  location_path: string | null
  acknowledged_by: { id: number; full_name: string } | null
}

export const aiApi = {
  config: {
    get: () => apiClient.get<{ data: AIConfig }>('/ai/config'),
  },
  /** Asks the AI for a priority. Saves nothing. */
  suggestPriority: (body: { title: string; description?: string; asset_id?: number }) =>
    apiClient.post<{ data: PrioritySuggestion }>('/ai/priority', body),
  anomalies: {
    list: (params?: { status?: SensorAnomaly['status']; asset_id?: number }) =>
      apiClient.get<{ sensor_anomalies: SensorAnomaly[] }>('/sensor_anomalies', { params }),
    acknowledge: (id: number, notes?: string) => apiClient.patch<{ data: SensorAnomaly }>(`/sensor_anomalies/${id}/acknowledge`, { notes }),
    dismiss: (id: number, notes?: string) => apiClient.patch<{ data: SensorAnomaly }>(`/sensor_anomalies/${id}/dismiss`, { notes }),
  },
  settings: {
    get: () => apiClient.get<{ ai: AiSettings }>('/ai_settings'),
    update: (ai: AiForm) => apiClient.patch<{ ai: AiSettings }>('/ai_settings', { ai }),
    remove: () => apiClient.delete<{ ai: AiSettings }>('/ai_settings'),
    /** Asks the model one fixed question through these settings (over the saved ones) without saving them. */
    test: (ai: AiForm) => apiClient.post<{ success: boolean; message: string; reply: string }>('/ai_settings/test', { ai }),
  },
}
