import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { iotApi } from '@/api'

export function useIotAlerts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['iot_alerts', params],
    queryFn: () => iotApi.alerts.list(params).then((r) => r.data),
  })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.alerts.acknowledge(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_alerts'] })
      toast.success('Alert acknowledged.')
    },
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.alerts.resolve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_alerts'] })
      toast.success('Alert resolved.')
    },
  })
}

export function useSensorTrends(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sensor_trends', params],
    queryFn: () => iotApi.sensorTrends(params).then((r) => r.data),
    enabled: !!params?.asset_id,
  })
}
