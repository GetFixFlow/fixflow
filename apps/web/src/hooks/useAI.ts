import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiApi } from '@/api'
import type { AiForm } from '@/api/ai'

export const AI_CONFIG_KEY = ['ai', 'config'] as const

export function useAI() {
  const { data, isLoading } = useQuery({
    queryKey: AI_CONFIG_KEY,
    queryFn: () => aiApi.config.get().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  })

  return {
    enabled: data?.enabled ?? false,
    model: data?.model,
    provider: data?.provider,
    source: data?.source,
    isLoading,
  }
}

export const AI_SETTINGS_KEY = ['ai', 'settings'] as const

/** Only an administrator may read these, so anyone else's page does not ask. */
export function useAiSettings(enabled = true) {
  return useQuery({ queryKey: AI_SETTINGS_KEY, queryFn: () => aiApi.settings.get().then((r) => r.data.ai), enabled })
}

/** What the rest of the app shows depends on whether AI is on, so a change refreshes both. */
function useRefreshAi() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: AI_SETTINGS_KEY })
    qc.invalidateQueries({ queryKey: AI_CONFIG_KEY })
  }
}

export function useSaveAiSettings() {
  const refresh = useRefreshAi()
  return useMutation({ mutationFn: (form: AiForm) => aiApi.settings.update(form), onSuccess: refresh })
}

export function useRemoveAiSettings() {
  const refresh = useRefreshAi()
  return useMutation({ mutationFn: () => aiApi.settings.remove(), onSuccess: refresh })
}

/** The test answers with a sentence either way, so the caller shows it beside the button rather than as a toast. */
export function useTestAi() {
  return useMutation({ mutationFn: (form: AiForm) => aiApi.settings.test(form) })
}
