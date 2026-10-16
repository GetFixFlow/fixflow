import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { iotApi } from '@/api'
import { apiErrorMessage } from '@/lib/apiError'

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
    onSuccess: () => toast.success('Alert acknowledged.'),
    // Also after a failure: the alert may have moved on (someone else resolved it), so show it as it is now.
    onSettled: () => qc.invalidateQueries({ queryKey: ['iot_alerts'] }),
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not acknowledge the alert. Try again.')),
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.alerts.resolve(id),
    onSuccess: () => toast.success('Alert resolved.'),
    // Also after a failure: the alert may have moved on (someone else resolved it), so show it as it is now.
    onSettled: () => qc.invalidateQueries({ queryKey: ['iot_alerts'] }),
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not resolve the alert. Try again.')),
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
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not create the rule.')),
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
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not save the rule.')),
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
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not pause the rule.')),
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
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not resume the rule.')),
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
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not archive the rule.')),
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
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not duplicate the rule.')),
  })
}

export function useTestIotRule() {
  return useMutation({
    mutationFn: ({ id, value }: { id: number; value: number }) =>
      iotApi.rules.test(id, value).then((r) => r.data),
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not test the rule. Try again.')),
  })
}

// ── Alerts (extended) ─────────────────────────────────────────────────────────

export function useSuppressAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => iotApi.alerts.suppress(id),
    onSuccess: () => toast.success('Alert suppressed.'),
    // Also after a failure: the alert may have moved on (someone else resolved it), so show it as it is now.
    onSettled: () => qc.invalidateQueries({ queryKey: ['iot_alerts'] }),
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not suppress the alert. Try again.')),
  })
}

export function useBulkAcknowledgeAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => iotApi.alerts.bulkAcknowledge(ids),
    onSuccess: (res) => {
      const { updated, skipped } = res.data as { updated: number; skipped: number }
      toast.success(
        `${updated} ${updated === 1 ? 'alert' : 'alerts'} acknowledged` +
          (skipped ? `, ${skipped} skipped (already dealt with).` : '.'),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['iot_alerts'] }),
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update the alerts. Try again.')),
  })
}

export function useBulkResolveAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => iotApi.alerts.bulkResolve(ids),
    onSuccess: (res) => {
      const { updated, skipped } = res.data as { updated: number; skipped: number }
      toast.success(
        `${updated} ${updated === 1 ? 'alert' : 'alerts'} resolved` +
          (skipped ? `, ${skipped} skipped (already dealt with).` : '.'),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['iot_alerts'] }),
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not update the alerts. Try again.')),
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
