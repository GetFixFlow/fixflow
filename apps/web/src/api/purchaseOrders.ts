import { apiClient } from './client'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types'
import type { PartsMeta } from './parts'

export interface PurchaseLineInput {
  id?: number
  part_id: number
  quantity: number
  /** Left out, the part's own cost is used. */
  unit_cost?: number | null
}

export interface PurchaseOrderInput {
  reason?: string | null
  notes?: string | null
}

export interface PurchaseOrderListParams {
  status?: PurchaseOrderStatus[]
  search?: string
  page?: number
}

export interface OrderDetails {
  vendor_id: number
  expected_on?: string | null
  supplier_reference?: string | null
}

export const purchaseOrdersApi = {
  list: (params?: PurchaseOrderListParams) =>
    apiClient.get<{ purchase_orders: PurchaseOrder[]; waiting_for_approval: number | null; meta: PartsMeta }>('/purchase_orders', {
      params: { ...params, status: params?.status?.join(',') },
    }),
  get: (id: number) => apiClient.get<{ data: PurchaseOrder }>(`/purchase_orders/${id}`),
  create: (purchase_order: PurchaseOrderInput, lines: PurchaseLineInput[]) =>
    apiClient.post<{ data: PurchaseOrder }>('/purchase_orders', { purchase_order, lines }),
  update: (id: number, purchase_order: PurchaseOrderInput, lines: PurchaseLineInput[]) =>
    apiClient.patch<{ data: PurchaseOrder }>(`/purchase_orders/${id}`, { purchase_order, lines }),
  approve: (id: number) => apiClient.post<{ data: PurchaseOrder }>(`/purchase_orders/${id}/approve`),
  reject: (id: number, reason: string) => apiClient.post<{ data: PurchaseOrder }>(`/purchase_orders/${id}/reject`, { reason }),
  order: (id: number, details: OrderDetails) => apiClient.post<{ data: PurchaseOrder }>(`/purchase_orders/${id}/order`, details),
  receive: (id: number, lines: { id: number; quantity: number }[]) =>
    apiClient.post<{ data: PurchaseOrder }>(`/purchase_orders/${id}/receive`, { lines }),
  close: (id: number) => apiClient.post<{ data: PurchaseOrder }>(`/purchase_orders/${id}/close`),
  cancel: (id: number) => apiClient.post<{ data: PurchaseOrder }>(`/purchase_orders/${id}/cancel`),
}
