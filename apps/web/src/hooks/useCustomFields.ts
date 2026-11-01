import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { customFieldsApi, type CustomFieldChanges, type CustomFieldInput } from '@/api/customFields'
import type { CustomField, CustomFieldEntity } from '@/types/customFields'

const KEY = ['custom-fields']

/**
 * The fields of one kind of record. Anyone signed in gets the ones that are on (the forms need them); an
 * administrator also gets those turned off, so the ones to show are filtered with `activeFields`.
 */
export function useCustomFields(entity: CustomFieldEntity) {
  return useQuery({
    queryKey: [...KEY, entity],
    queryFn: () => customFieldsApi.list(entity).then((r) => r.data.custom_fields),
    staleTime: 60_000,
  })
}

export const activeFields = (fields: CustomField[] | undefined) => (fields ?? []).filter((field) => field.active)

function failure(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? fallback)
}

function useRefreshing<TArgs>(fn: (args: TArgs) => Promise<unknown>, success: string, fallback: string) {
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

export const useAddCustomField = () =>
  useRefreshing((input: CustomFieldInput) => customFieldsApi.create(input), 'Field added.', 'Could not add the field.')

export const useChangeCustomField = () =>
  useRefreshing(
    ({ id, changes }: { id: number; changes: CustomFieldChanges }) => customFieldsApi.update(id, changes),
    'Field saved.',
    'Could not save the field.',
  )

export const useDeleteCustomField = () =>
  useRefreshing((id: number) => customFieldsApi.remove(id), 'Field deleted.', 'Could not delete the field.')

export const useReorderCustomFields = () =>
  useRefreshing(
    ({ entity, ids }: { entity: CustomFieldEntity; ids: number[] }) => customFieldsApi.reorder(entity, ids),
    'Order saved.',
    'Could not save the order.',
  )
