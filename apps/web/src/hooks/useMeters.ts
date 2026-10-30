import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { metersApi, type MeterInput } from '@/api/meters'
import { PM_KEY } from '@/hooks/usePreventiveMaintenance'
import { WO_KEY } from '@/hooks/useWorkOrders'

/** The meters of an asset. */
export function useAssetMeters(assetId: number | undefined) {
  return useQuery({
    queryKey: ['meters', assetId],
    queryFn: () => metersApi.list(assetId!).then((r) => r.data.meters),
    enabled: !!assetId,
  })
}

/** The recent readings of one meter (only asked for when its history is open). */
export function useMeterReadings(meterId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['meters', 'readings', meterId],
    queryFn: () => metersApi.readings(meterId).then((r) => r.data.readings),
    enabled,
  })
}

function failure(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? fallback)
}

/** A reading can make a maintenance schedule fall due, so the schedules and work orders are refreshed too. */
function useRefreshing<TArgs>(fn: (args: TArgs) => Promise<unknown>, success: string, fallback: string, alsoSchedules = false) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => fn(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meters'] })
      if (alsoSchedules) {
        qc.invalidateQueries({ queryKey: PM_KEY })
        qc.invalidateQueries({ queryKey: WO_KEY })
      }
      toast.success(success)
    },
    onError: failure(fallback),
  })
}

export const useCreateMeter = (assetId: number) =>
  useRefreshing((data: MeterInput) => metersApi.create(assetId, data), 'Meter added.', 'Could not add the meter.')

export const useUpdateMeter = (id: number) =>
  useRefreshing((data: Partial<MeterInput>) => metersApi.update(id, data), 'Meter changed.', 'Could not change the meter.')

export const useDeleteMeter = (id: number) =>
  useRefreshing(() => metersApi.destroy(id), 'Meter deleted.', 'Could not delete the meter.')

export const useRecordReading = (id: number) =>
  useRefreshing(
    (data: { value: string; note?: string; reset?: boolean }) => metersApi.record(id, data),
    'Reading saved.',
    'Could not save the reading.',
    true,
  )
