import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { downtimesApi, type DowntimeInput } from '@/api/downtimes'
import { ASSETS_KEY } from '@/hooks/useAssets'
import { t } from '@/i18n'

export const DOWNTIME_KEY = 'downtimes'

/** The times an asset was out of action, newest first. */
export function useDowntimes(assetId: number | undefined) {
  return useQuery({
    queryKey: [DOWNTIME_KEY, assetId],
    queryFn: () => downtimesApi.list(assetId!).then((r) => r.data.downtimes),
    enabled: !!assetId,
  })
}

function failure(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? fallback)
}

/** Stopping or restarting changes the asset's status too, and the reports, so those are refreshed with the list. */
function useRefreshing<TArgs>(fn: (args: TArgs) => Promise<unknown>, success: string, fallback: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => fn(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [DOWNTIME_KEY] })
      qc.invalidateQueries({ queryKey: ASSETS_KEY })
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success(success)
    },
    onError: failure(fallback),
  })
}

export const useRecordDowntime = (assetId: number) =>
  useRefreshing((data: DowntimeInput) => downtimesApi.create(assetId, data), t('assets.toasts.downtime_recorded'), t('assets.toasts.downtime_record_failed'))

export const useRestart = () =>
  useRefreshing(({ id, endedAt }: { id: number; endedAt?: string }) => downtimesApi.restart(id, endedAt), t('assets.toasts.back_in_service'),
    t('assets.toasts.restart_failed'))

export const useUpdateDowntime = (id: number) =>
  useRefreshing((data: DowntimeInput) => downtimesApi.update(id, data), t('assets.toasts.downtime_updated'), t('assets.toasts.downtime_update_failed'))

export const useDeleteDowntime = () =>
  useRefreshing((id: number) => downtimesApi.destroy(id), t('assets.toasts.downtime_deleted'), t('assets.toasts.downtime_delete_failed'))
