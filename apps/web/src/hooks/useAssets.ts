import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { assetsApi } from '@/api'
import type { Asset } from '@/types'

export const ASSETS_KEY = ['assets'] as const

export function useAssets(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...ASSETS_KEY, params],
    queryFn: () => assetsApi.list(params).then((r) => r.data),
  })
}

export function useAsset(id: number) {
  return useQuery({
    queryKey: [...ASSETS_KEY, id],
    queryFn: () => assetsApi.get(id).then((r) => r.data.data),
    enabled: !!id,
  })
}

export function useCreateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Asset>) => assetsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ASSETS_KEY })
      toast.success('Asset created.')
    },
    onError: () => toast.error('Failed to create asset.'),
  })
}

export function useUpdateAsset(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Asset>) => assetsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ASSETS_KEY })
      toast.success('Asset updated.')
    },
    onError: () => toast.error('Failed to update asset.'),
  })
}

export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => assetsApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ASSETS_KEY })
      toast.success('Asset deleted.')
    },
    onError: () => toast.error('Failed to delete asset.'),
  })
}
