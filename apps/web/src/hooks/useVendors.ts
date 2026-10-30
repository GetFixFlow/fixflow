import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { vendorsApi, type VendorContactInput, type VendorInput, type VendorListParams } from '@/api/vendors'
import { workOrdersApi } from '@/api/workOrders'
import { WO_KEY } from '@/hooks/useWorkOrders'

/** One page of the vendor list, with the categories in use (for the filter) and the paging details. */
export function useVendorList(params: VendorListParams) {
  return useQuery({
    queryKey: ['vendors', 'list', params],
    queryFn: () => vendorsApi.list(params).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
}

/** The vendors a work order can be given to (the active ones, by name). */
export function useActiveVendors(enabled = true) {
  return useQuery({
    queryKey: ['vendors', 'active'],
    queryFn: () => vendorsApi.list({ active: true }).then((r) => r.data.vendors),
    enabled,
  })
}

/** One vendor with its contacts. */
export function useVendor(id: number | undefined) {
  return useQuery({
    queryKey: ['vendors', 'one', id],
    queryFn: () => vendorsApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  })
}

function failure(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? fallback)
}

function useRefreshing<TArgs>(fn: (args: TArgs) => Promise<unknown>, success: string, fallback: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => fn(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      toast.success(success)
    },
    onError: failure(fallback),
  })
}

export const useCreateVendor = () => useRefreshing((v: VendorInput) => vendorsApi.create(v), 'Vendor added.', 'Could not add the vendor.')

export const useUpdateVendor = (id: number) =>
  useRefreshing((v: Partial<VendorInput>) => vendorsApi.update(id, v), 'Vendor updated.', 'Could not update the vendor.')

export const useDeleteVendor = () => useRefreshing((id: number) => vendorsApi.remove(id), 'Vendor deleted.', 'Could not delete the vendor.')

export const useAddVendorContact = (vendorId: number) =>
  useRefreshing((c: VendorContactInput) => vendorsApi.addContact(vendorId, c), 'Contact added.', 'Could not add the contact.')

export const useRemoveVendorContact = (vendorId: number) =>
  useRefreshing((contactId: number) => vendorsApi.removeContact(vendorId, contactId), 'Contact removed.', 'Could not remove the contact.')

export interface VendorAssignment {
  vendor_id: number | null
  vendor_cost: number
  vendor_reference: string | null
}

/** Give a work order to a vendor (or take it off one), with what they charged and their invoice number. */
export function useGiveToVendor(workOrderId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: VendorAssignment) => workOrdersApi.update(workOrderId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WO_KEY })
      qc.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor saved.')
    },
    onError: failure('Could not save the vendor.'),
  })
}
