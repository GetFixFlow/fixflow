import { apiClient } from './client'

/** AI is off until an administrator picks one. `local` is a model run on the company's own network: nothing leaves it. */
export type AiProvider = 'none' | 'anthropic' | 'openai_compatible' | 'local'
export type AiChoice = Exclude<AiProvider, 'none'>

export interface AIConfig {
  enabled: boolean
  model: string
  provider: AiProvider
  /** `app` when saved on the settings screen, `environment` when it comes from the server's .env, else none. */
  source: 'app' | 'environment' | null
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
  providers: Record<AiChoice, AiProviderSettings>
}

/** The fields of the chosen provider. A blank key keeps the one already saved. */
export interface AiForm {
  provider: AiProvider
  model?: string
  base_url?: string
  api_key?: string
}

export const aiApi = {
  config: {
    get: () => apiClient.get<{ data: AIConfig }>('/ai/config'),
  },
  settings: {
    get: () => apiClient.get<{ ai: AiSettings }>('/ai_settings'),
    update: (ai: AiForm) => apiClient.patch<{ ai: AiSettings }>('/ai_settings', { ai }),
    remove: () => apiClient.delete<{ ai: AiSettings }>('/ai_settings'),
    /** Asks the model one fixed question through these settings (over the saved ones) without saving them. */
    test: (ai: AiForm) => apiClient.post<{ success: boolean; message: string; reply: string }>('/ai_settings/test', { ai }),
  },
}
