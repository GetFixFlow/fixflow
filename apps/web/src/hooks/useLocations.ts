import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { locationsApi } from '@/api'
import type { Location } from '@/types'
import { buildLocationTree } from '@/utils/locationUtils'

export const LOCATIONS_KEY = ['locations'] as const

export function useLocations(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...LOCATIONS_KEY, params],
    queryFn: () => locationsApi.list(params).then((r) => r.data.locations),
  })
}

export function useLocationTree() {
  return useQuery({
    queryKey: [...LOCATIONS_KEY, 'tree'],
    queryFn: () =>
      locationsApi.list().then((r) => buildLocationTree(r.data.locations)),
  })
}

export function useLocation(id: number | null | undefined) {
  return useQuery({
    queryKey: [...LOCATIONS_KEY, id],
    queryFn: () => locationsApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  })
}

export function useCreateLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Location>) => locationsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOCATIONS_KEY })
      toast.success('Location created.')
    },
    onError: () => toast.error('Failed to create location.'),
  })
}

export function useUpdateLocation(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Location>) => locationsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOCATIONS_KEY })
      toast.success('Location updated.')
    },
    onError: () => toast.error('Failed to update location.'),
  })
}

export function useDeleteLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => locationsApi.destroy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOCATIONS_KEY })
      toast.success('Location deleted.')
    },
    onError: () => toast.error('Failed to delete location.'),
  })
}
