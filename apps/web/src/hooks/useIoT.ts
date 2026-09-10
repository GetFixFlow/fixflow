import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { iotApi } from '@/api'

// ── Existing hooks ────────────────────────────────────────────────────────────

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

// ── Rules CRUD ────────────────────────────────────────────────────────────────

export function useIotRules(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['iot_rules', params],
    queryFn: () => iotApi.rules.list(params).then((r) => r.data),
  })
}

export function useIotRule(id: number) {
  return useQuery({
    queryKey: ['iot_rules', id],
    queryFn: () => iotApi.rules.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateIotRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: iotApi.rules.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_rules'] })
      toast.success('Rule created.')
    },
  })
}

export function useUpdateIotRule(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof iotApi.rules.update>[1]) =>
      iotApi.rules.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_rules'] })
      toast.success('Rule updated.')
    },
  })
}

export function usePauseIotRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.rules.pause(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_rules'] })
      toast.success('Rule paused.')
    },
  })
}

export function useResumeIotRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.rules.resume(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_rules'] })
      toast.success('Rule resumed.')
    },
  })
}

export function useArchiveIotRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.rules.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_rules'] })
      toast.success('Rule archived.')
    },
  })
}

export function useDuplicateIotRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.rules.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_rules'] })
      toast.success('Rule duplicated.')
    },
  })
}

export function useTestIotRule() {
  return useMutation({
    mutationFn: ({ id, value }: { id: number; value: number }) =>
      iotApi.rules.test(id, value).then((r) => r.data),
  })
}

// ── Alerts (extended) ─────────────────────────────────────────────────────────

export function useSuppressAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.alerts.suppress(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_alerts'] })
      toast.success('Alert suppressed.')
    },
  })
}

export function useBulkAcknowledgeAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => iotApi.alerts.bulkAcknowledge(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_alerts'] })
    },
  })
}

export function useBulkResolveAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => iotApi.alerts.bulkResolve(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['iot_alerts'] })
    },
  })
}

export function useAssetAlertHistory(assetId: number, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['iot_alerts', 'asset', assetId, params],
    queryFn: () => iotApi.alerts.history(assetId, params).then((r) => r.data),
    enabled: !!assetId,
  })
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function useIotDashboard() {
  return useQuery({
    queryKey: ['iot_dashboard'],
    queryFn: () => iotApi.dashboard().then((r) => r.data),
    refetchInterval: 30_000,
  })
}

// ── Readings ──────────────────────────────────────────────────────────────────

export function useAssetReadings(assetId: number, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sensor_readings', assetId, params],
    queryFn: () => iotApi.readings.list(assetId, params).then((r) => r.data),
    enabled: !!assetId,
  })
}

export function useReadingsActivity(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['readings_activity', params],
    queryFn: () => iotApi.readings.activity(params).then((r) => r.data),
  })
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery({
    queryKey: ['api_keys'],
    queryFn: () => iotApi.apiKeys.list().then((r) => r.data),
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: iotApi.apiKeys.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api_keys'] })
    },
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.apiKeys.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api_keys'] })
      toast.success('API key revoked.')
    },
  })
}
