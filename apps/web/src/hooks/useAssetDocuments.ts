import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { assetDocumentsApi } from '@/api/assetDocuments'

const KEY = 'asset-documents'

/** The manuals, photos and certificates kept with an asset. */
export function useAssetDocuments(assetId: number | undefined) {
  return useQuery({
    queryKey: [KEY, assetId],
    queryFn: () => assetDocumentsApi.list(assetId!).then((r) => r.data.documents),
    enabled: !!assetId,
  })
}

function failure(fallback: string) {
  return (error: AxiosError<{ error?: { message?: string } }>) => toast.error(error.response?.data?.error?.message ?? fallback)
}

export function useUploadAssetDocument(assetId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, description }: { file: File; description?: string }) => assetDocumentsApi.upload(assetId, file, description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, assetId] })
      toast.success('Added.')
    },
    onError: failure('Could not add the file.'),
  })
}

export function useDeleteAssetDocument(assetId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => assetDocumentsApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, assetId] })
      toast.success('Removed.')
    },
    onError: failure('Could not remove the file.'),
  })
}
