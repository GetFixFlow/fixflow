import { useQuery } from '@tanstack/react-query'
import { systemApi } from '@/api'

/** Checked live on the server each time; read again every 30 seconds while the page is open. Administrators only. */
export function useSystemHealth(enabled = true) {
  return useQuery({
    queryKey: ['system_health'],
    queryFn: () => systemApi.health().then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 0,
    enabled,
  })
}
