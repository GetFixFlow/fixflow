import { useQuery } from '@tanstack/react-query'
import { aiApi } from '@/api'

export const AI_CONFIG_KEY = ['ai', 'config'] as const

export function useAI() {
  const { data, isLoading } = useQuery({
    queryKey: AI_CONFIG_KEY,
    queryFn: () => aiApi.config.get().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  })

  return {
    enabled: data?.enabled ?? false,
    model: data?.model,
    isLoading,
  }
}
