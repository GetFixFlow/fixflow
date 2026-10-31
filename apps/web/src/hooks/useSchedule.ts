import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { scheduleApi } from '@/api/schedule'
import { WO_KEY } from '@/hooks/useWorkOrders'
import type { RescheduleInput } from '@/types/schedule'

export const SCHEDULE_KEY = 'schedule'

/** Who has what work on which day, from `from` to `to` (YYYY-MM-DD). */
export function useSchedule(from: string, to: string) {
  return useQuery({
    queryKey: [SCHEDULE_KEY, from, to],
    queryFn: () => scheduleApi.get(from, to).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })
}

/** Move a work order to another person, another day, or both. */
export function useReschedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RescheduleInput }) => scheduleApi.reschedule(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SCHEDULE_KEY] })
      qc.invalidateQueries({ queryKey: WO_KEY })
      toast.success('Moved.')
    },
    onError: (error: AxiosError<{ error?: { message?: string } }>) =>
      toast.error(error.response?.data?.error?.message ?? 'Could not move the work order.'),
  })
}
