import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { savedReportsApi, type SavedReportInput } from '@/api/savedReports'
import type { SavedReportKind } from '@/types/savedReports'

const KEY = ['saved-reports']

/** The saved reports (those of one report, when asked), and the managers a report can be emailed to. */
export function useSavedReports(report?: SavedReportKind) {
  return useQuery({
    queryKey: [...KEY, report ?? 'all'],
    queryFn: () => savedReportsApi.list(report).then((r) => r.data),
    staleTime: 30_000,
  })
}

type Failure = AxiosError<{ error?: { message?: string } }>

function failure(fallback: string) {
  return (error: Failure) => toast.error(error.response?.data?.error?.message ?? fallback)
}

function useRefreshing<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, success: string, fallback: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => fn(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success(success)
    },
    onError: failure(fallback),
  })
}

export const useCreateSavedReport = () =>
  useRefreshing((input: SavedReportInput) => savedReportsApi.create(input), 'Saved.', 'Could not save it.')

export const useUpdateSavedReport = () =>
  useRefreshing(
    ({ id, changes }: { id: number; changes: Parameters<typeof savedReportsApi.update>[1] }) => savedReportsApi.update(id, changes),
    'Saved.',
    'Could not save the changes.',
  )

export const useDeleteSavedReport = () =>
  useRefreshing((id: number) => savedReportsApi.remove(id), 'Deleted.', 'Could not delete it.')

/** Emails the PDF to the person asking. */
export function useSendSavedReportNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => savedReportsApi.sendNow(id).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success(`Sent to ${data.sent_to}.`)
    },
    onError: failure('Could not send it.'),
  })
}
