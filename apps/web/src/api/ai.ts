import { apiClient } from './client'

/** AI is off until an administrator picks one. `local` is a model run on the company's own network: nothing leaves it. */
export type AiProvider = 'none' | 'anthropic' | 'openai_compatible' | 'local'
export type AiChoice = Exclude<AiProvider, 'none'>

/** What the AI does, each of which an administrator can switch off. */
export type AiFeature = 'priority' | 'anomalies' | 'limits' | 'parts' | 'draft'
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

/** An asset the words may be about. */
export interface DraftAsset {
  id: number
  name: string
  asset_tag: string | null
  location_path: string | null
}

/** A draft work order made from a few plain words, for the person to check. The asset is set only when one of the matches clearly is it. */
export interface WorkOrderDraft {
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low' | null
  asset: DraftAsset | null
  /** The assets the draft chose from, to pick from when it chose none. */
  asset_candidates: DraftAsset[]
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

/** A sensor on course to reach a limit set on an alert rule, with the range the data allow. */
export interface LimitForecast {
  rule: { id: number; name: string }
  asset: { id: number; name: string; asset_tag: string | null; location_path: string | null }
  metric_name: string
  unit: string | null
  limit: number
  current: number
  /** How much it moves a day (negative when it is falling). */
  slope_per_day: number
  days_left: number
  days_soonest: number
  days_latest: number
  /** The date it reaches the limit at this rate. */
  reaches_on: string
  r2: number
  days_of_history: number
  points: number
}

/** What is expected of a part over the next 30 days, and whether what is held and on order covers it. */
export interface PartForecast {
  part: { id: number; name: string; sku: string | null; unit: string | null }
  status: 'short' | 'tight' | 'ok'
  used_last_30_days: number
  expected: number
  low: number
  high: number
  on_hand: number
  on_order: number
  days_of_stock: number | null
  suggested_quantity: number
  /** How many 30-day periods of use it rests on, and how many times the part was logged in them. */
  periods: number
  uses: number
}

export const aiApi = {
  config: {
    get: () => apiClient.get<{ data: AIConfig }>('/ai/config'),
  },
  /** Makes a draft work order from a few plain words. Saves nothing. */
  draftWorkOrder: (text: string) => apiClient.post<{ data: WorkOrderDraft }>('/ai/work_order_draft', { text }),
  /** Asks the AI for a priority. Saves nothing. */
  suggestPriority: (body: { title: string; description?: string; asset_id?: number }) =>
    apiClient.post<{ data: PrioritySuggestion }>('/ai/priority', body),
  forecasts: {
    limits: () => apiClient.get<{ data: LimitForecast[] }>('/ai/forecasts/limits'),
    parts: () => apiClient.get<{ data: PartForecast[] }>('/ai/forecasts/parts'),
  },
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
