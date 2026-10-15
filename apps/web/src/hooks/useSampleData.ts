import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { gettingStartedApi, sampleDataApi } from '@/api/sampleData'

const failure = (fallback: string) => (error: AxiosError<{ error?: { message?: string } }>) =>
  toast.error(error.response?.data?.error?.message ?? fallback)

/** Whether sample data is in the install. Administrators only: others are not asked. */
export function useSampleData(enabled = true) {
  return useQuery({
    queryKey: ['sample_data'],
    queryFn: () => sampleDataApi.status().then((r) => r.data),
    enabled,
    staleTime: 60_000,
  })
}

/** Loading or removing sample data changes what almost every screen shows, so refresh them all. */
function useRefreshAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

export function useLoadSampleData() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: () => sampleDataApi.load().then((r) => r.data),
    onSuccess: () => { toast.success('Sample data added.'); refresh() },
    onError: failure('Could not add the sample data.'),
  })
}

export function useRemoveSampleData() {
  const refresh = useRefreshAll()
  return useMutation({
    mutationFn: () => sampleDataApi.remove().then((r) => r.data),
    onSuccess: (result) => {
      refresh()
      if (result.report.kept.length > 0) toast.info(`Sample data removed. ${result.report.kept.length} item${result.report.kept.length === 1 ? ' was' : 's were'} kept because you built on them.`)
      else toast.success('Sample data removed.')
    },
    onError: failure('Could not remove the sample data.'),
  })
}

export function useGettingStarted(enabled = true) {
  return useQuery({
    queryKey: ['getting_started'],
    queryFn: () => gettingStartedApi.get().then((r) => r.data),
    enabled,
  })
}

export function useDismissGettingStarted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => gettingStartedApi.dismiss().then((r) => r.data),
    onSuccess: (data) => qc.setQueryData(['getting_started'], data),
    onError: failure('Could not put that away.'),
  })
}
