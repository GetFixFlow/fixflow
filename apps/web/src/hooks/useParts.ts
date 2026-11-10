import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { partsApi } from '@/api/parts'
import { t } from '@/i18n'

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
  useRefreshingMutation(partsApi.create, t('parts.toasts.added'), t('parts.toasts.add_failed'))

export const useUpdatePart = (id: number) =>
  useRefreshingMutation((part: Parameters<typeof partsApi.update>[1]) => partsApi.update(id, part), t('parts.toasts.updated'), t('parts.toasts.update_failed'))

export const useDeletePart = () =>
  useRefreshingMutation((id: number) => partsApi.remove(id), t('parts.toasts.deleted'), t('parts.toasts.delete_failed'))

export const useAdjustStock = (id: number) =>
  useRefreshingMutation(
    (body: Parameters<typeof partsApi.adjustStock>[1]) => partsApi.adjustStock(id, body),
    t('parts.toasts.stock_updated'),
    t('parts.toasts.stock_failed'),
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
