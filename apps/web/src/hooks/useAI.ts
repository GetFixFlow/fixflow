import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { aiApi } from '@/api'
import type { AiForm, SensorAnomaly } from '@/api/ai'
import { apiErrorMessage } from '@/lib/apiError'

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
    /** A feature is on when AI is, and the administrator has not switched it off. */
    features: data?.features ?? { priority: false, anomalies: false },
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

/** The AI's suggestion for the priority of a work order being written. The caller shows the answer or the error beside the button. */
export function useSuggestPriority() {
  return useMutation({
    mutationFn: (body: { title: string; description?: string; asset_id?: number }) => aiApi.suggestPriority(body).then((r) => r.data.data),
  })
}

export const SENSOR_ANOMALIES_KEY = ['sensor_anomalies'] as const

/** The readings flagged as unusual. Only asked for when the feature is on. */
export function useSensorAnomalies(status: SensorAnomaly['status'], enabled: boolean) {
  return useQuery({
    queryKey: [...SENSOR_ANOMALIES_KEY, status],
    queryFn: () => aiApi.anomalies.list({ status }).then((r) => r.data.sensor_anomalies),
    enabled,
  })
}

/** A manager says a flag is real (`acknowledge`) or nothing (`dismiss`). The list is read again either way: it may have moved on. */
export function useAnswerAnomaly(action: 'acknowledge' | 'dismiss') {
  const qc = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (id: number) => aiApi.anomalies[action](id),
    onSuccess: () => toast.success(t(`ai.anomalies.${action}_done`)),
    onSettled: () => qc.invalidateQueries({ queryKey: SENSOR_ANOMALIES_KEY }),
    onError: (error) => toast.error(apiErrorMessage(error, t('ai.anomalies.action_failed'))),
  })
}
