import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { partsApi } from '@/api/parts'

/** The part catalog, optionally narrowed by name or SKU. */
export function useParts(search = '', enabled = true) {
  return useQuery({
    queryKey: ['parts', search],
    queryFn: () => partsApi.list({ search: search || undefined }).then((r) => r.data.parts),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** One page of the catalog for the parts screen, with the paging details. */
export function useCatalog(params: { search: string; lowStock: boolean; page: number }) {
  return useQuery({
    queryKey: ['parts', 'catalog', params],
    queryFn: () =>
      partsApi
        .list({ search: params.search || undefined, low_stock: params.lowStock || undefined, page: params.page })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  })
}

function failureMessage(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) =>
    toast.error(error.response?.data?.error?.message ?? fallback)
}

/** Every change to a part can alter what the work order screens offer, so refresh all part lists. */
function useRefreshingMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>, success: string, failure: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => fn(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] })
      toast.success(success)
    },
    onError: failureMessage(failure),
  })
}

export const useCreatePart = () =>
  useRefreshingMutation(partsApi.create, 'Part added.', 'Could not add the part.')

export const useUpdatePart = (id: number) =>
  useRefreshingMutation((part: Parameters<typeof partsApi.update>[1]) => partsApi.update(id, part), 'Part updated.', 'Could not update the part.')

export const useDeletePart = () =>
  useRefreshingMutation((id: number) => partsApi.remove(id), 'Part deleted.', 'Could not delete the part.')

export const useAdjustStock = (id: number) =>
  useRefreshingMutation(
    (body: Parameters<typeof partsApi.adjustStock>[1]) => partsApi.adjustStock(id, body),
    'Stock updated.',
    'Could not change the stock.',
  )

/** A value that only changes after it has stopped changing for `delay` ms, so typing does not search every key. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
