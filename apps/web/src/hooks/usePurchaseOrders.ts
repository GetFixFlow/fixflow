import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { purchaseOrdersApi, type PurchaseLineInput, type PurchaseOrderInput, type PurchaseOrderListParams } from '@/api/purchaseOrders'

/** One page of the purchase requests and orders, with how many are waiting for a decision (managers only). */
export function usePurchaseOrderList(params: PurchaseOrderListParams) {
  return useQuery({
    queryKey: ['purchase-orders', 'list', params],
    queryFn: () => purchaseOrdersApi.list(params).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
}

/** One order with its lines. */
export function usePurchaseOrder(id: number | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', 'one', id],
    queryFn: () => purchaseOrdersApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  })
}

function failure(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? fallback)
}

/** Every step changes the lists, and receiving changes the stock the parts screens show. */
function useRefreshing<TArgs>(fn: (args: TArgs) => Promise<unknown>, success: string, fallback: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => fn(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      qc.invalidateQueries({ queryKey: ['parts'] })
      toast.success(success)
    },
    onError: failure(fallback),
  })
}

export const useCreatePurchaseOrder = () =>
  useRefreshing(
    (args: { order: PurchaseOrderInput; lines: PurchaseLineInput[] }) => purchaseOrdersApi.create(args.order, args.lines),
    'Request sent.',
    'Could not send the request.',
  )

export const useUpdatePurchaseOrder = (id: number) =>
  useRefreshing(
    (args: { order: PurchaseOrderInput; lines: PurchaseLineInput[] }) => purchaseOrdersApi.update(id, args.order, args.lines),
    'Request updated.',
    'Could not update the request.',
  )

export const useApprovePurchaseOrder = (id: number) =>
  useRefreshing(() => purchaseOrdersApi.approve(id), 'Approved.', 'Could not approve it.')

export const useRejectPurchaseOrder = (id: number) =>
  useRefreshing((reason: string) => purchaseOrdersApi.reject(id, reason), 'Turned down.', 'Could not turn it down.')

export const usePlaceOrder = (id: number) =>
  useRefreshing(
    (details: Parameters<typeof purchaseOrdersApi.order>[1]) => purchaseOrdersApi.order(id, details),
    'Marked as ordered.',
    'Could not place the order.',
  )

export const useReceiveOrder = (id: number) =>
  useRefreshing(
    (lines: Parameters<typeof purchaseOrdersApi.receive>[1]) => purchaseOrdersApi.receive(id, lines),
    'Received. The stock is updated.',
    'Could not record the delivery.',
  )

export const useCloseOrder = (id: number) =>
  useRefreshing(() => purchaseOrdersApi.close(id), 'Closed.', 'Could not close it.')

export const useCancelOrder = (id: number) =>
  useRefreshing(() => purchaseOrdersApi.cancel(id), 'Cancelled.', 'Could not cancel it.')
