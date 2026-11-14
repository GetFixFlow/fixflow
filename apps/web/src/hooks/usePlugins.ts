import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { pluginReportsApi, pluginsApi, type ChannelForm } from '@/api/plugins'
import { t } from '@/i18n'

function failure(fallbackKey: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? t(fallbackKey))
}

export function usePlugins() {
  return useQuery({ queryKey: ['plugins'], queryFn: pluginsApi.list })
}

export function useSetPluginEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => pluginsApi.setEnabled(key, enabled),
    onSuccess: (_data, { enabled }) => {
      // Switching a plugin on or off changes which reports the managers see.
      qc.invalidateQueries({ queryKey: ['plugins'] })
      qc.invalidateQueries({ queryKey: ['plugin_reports'] })
      toast.success(t(enabled ? 'plugins.toast.switched_on' : 'plugins.toast.switched_off'))
    },
    onError: failure('plugins.toast.switch_failed'),
  })
}

export function useSavePluginChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, channel, form }: { key: string; channel: string; form: ChannelForm }) => pluginsApi.saveChannel(key, channel, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] })
      toast.success(t('plugins.toast.saved'))
    },
    onError: failure('plugins.toast.save_failed'),
  })
}

export function useRemovePluginChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, channel }: { key: string; channel: string }) => pluginsApi.removeChannel(key, channel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plugins'] })
      toast.success(t('plugins.toast.removed'))
    },
    onError: failure('plugins.toast.remove_failed'),
  })
}

/** The test answers with a sentence either way, so the caller shows it beside the button rather than as a toast. */
export function useTestPluginChannel() {
  return useMutation({
    mutationFn: ({ key, channel, values }: { key: string; channel: string; values: Record<string, string> }) =>
      pluginsApi.testChannel(key, channel, values),
  })
}

/** The reports plugins add, for the Reports page. Retries nothing: a manager's page must not wait on a plugin. */
export function usePluginReports() {
  return useQuery({ queryKey: ['plugin_reports'], queryFn: pluginReportsApi.list, retry: false })
}
