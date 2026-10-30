import { apiClient } from './client'
import type { Vendor, VendorContact } from '@/types'
import type { PartsMeta } from './parts'

export interface VendorInput {
  name: string
  category?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  notes?: string | null
  active?: boolean
}

export interface VendorContactInput {
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
}

export interface VendorListParams {
  search?: string
  category?: string
  active?: boolean
  page?: number
}

export const vendorsApi = {
  list: (params?: VendorListParams) =>
    apiClient.get<{ vendors: Vendor[]; categories: string[]; meta: PartsMeta }>('/vendors', { params }),
  get: (id: number) => apiClient.get<{ data: Vendor }>(`/vendors/${id}`),
  create: (vendor: VendorInput) => apiClient.post<{ data: Vendor }>('/vendors', { vendor }),
  update: (id: number, vendor: Partial<VendorInput>) => apiClient.patch<{ data: Vendor }>(`/vendors/${id}`, { vendor }),
  remove: (id: number) => apiClient.delete(`/vendors/${id}`),
  addContact: (vendorId: number, contact: VendorContactInput) =>
    apiClient.post<{ data: VendorContact }>(`/vendors/${vendorId}/contacts`, { contact }),
  removeContact: (vendorId: number, contactId: number) => apiClient.delete(`/vendors/${vendorId}/contacts/${contactId}`),
}
