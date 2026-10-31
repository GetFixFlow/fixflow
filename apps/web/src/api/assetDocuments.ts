import { apiClient } from './client'
import type { AssetDocument } from '@/types'

export const assetDocumentsApi = {
  list: (assetId: number) => apiClient.get<{ documents: AssetDocument[] }>(`/assets/${assetId}/documents`),

  upload: (assetId: number, file: File, description?: string) => {
    const form = new FormData()
    form.append('document[file]', file)
    if (description) form.append('description', description)
    // No Content-Type header: axios leaves it to the browser, which adds multipart/form-data with the boundary the server needs.
    return apiClient.post<{ data: AssetDocument }>(`/assets/${assetId}/documents`, form)
  },

  destroy: (id: number) => apiClient.delete(`/asset_documents/${id}`),
}
