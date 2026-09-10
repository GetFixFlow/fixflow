import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api'
import type { DashboardStats } from '@/types'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportsApi.dashboard().then((r) => r.data as DashboardStats),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  })
}
