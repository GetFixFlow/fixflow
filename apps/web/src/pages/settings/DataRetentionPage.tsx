import { useState } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { HardDrive } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { useOrgSettings, useUpdateOrgSettings } from '@/hooks/useSettings'
import { dataUsageApi, type DataUsage } from '@/api/dataUsage'
import { AUDIT_CHOICES, SENSOR_CHOICES, describeDays, formatBytes, withCurrent } from '@/lib/retentionText'
import { formatDate, formatNumber } from '@/lib/localeFormat'

const SELECT = 'h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm'

const TABLE_LABELS: [keyof DataUsage['tables'], string][] = [
  ['sensor_readings', 'Sensor readings'],
  ['sensor_aggregates', 'Hourly sensor summaries'],
  ['activity_logs', 'Audit log'],
  ['iot_alerts', 'IoT alerts'],
  ['work_orders', 'Work orders'],
]

function Policy({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        {children}
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

/** What the nightly cleanup will do with the limit that is chosen, in a sentence. */
function removal(count: number | null | undefined, noun: string, at: string): { text: string; removes: boolean } {
  if (count === undefined) return { text: 'Counting…', removes: false }
  if (count === null) return { text: `How much is past this limit could not be counted just now (there is a lot of data).`, removes: false }
  if (count === 0) return { text: `Nothing is past this limit, so nothing will be deleted.`, removes: false }
  return { text: `${formatNumber(count)} ${noun} past this limit will be deleted for good in the next nightly cleanup (${at}).`, removes: true }
}

export function DataRetentionPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const queryClient = useQueryClient()
  const { data: settings } = useOrgSettings()
  const save = useUpdateOrgSettings()
  const [sensorEdit, setSensorEdit] = useState<number | null>(null)
  const [auditEdit, setAuditEdit] = useState<number | null>(null)

  const savedSensor = settings?.iot_data_retention_days
  const savedAudit = settings?.audit_log_retention_days
  const sensorDays = sensorEdit ?? savedSensor
  const auditDays = auditEdit ?? savedAudit
  const dirty = (sensorEdit !== null && sensorEdit !== savedSensor) || (auditEdit !== null && auditEdit !== savedAudit)

  // Asks what the limits being chosen would remove, before anything is saved.
  const { data: usage, isError } = useQuery({
    queryKey: ['data_usage', dirty ? sensorDays : null, dirty ? auditDays : null],
    queryFn: () => dataUsageApi.get(dirty ? { sensorDays, auditDays } : undefined),
    placeholderData: keepPreviousData,
    enabled: isAdmin,
  })

  if (!isAdmin) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Data Retention" description="How long data is kept" />
        <Card><CardContent className="p-8 text-center text-gray-500">Only administrators can manage data retention.</CardContent></Card>
      </div>
    )
  }

  const sensor = removal(usage?.sensor_data.removable_readings, 'readings', usage?.cleanup_at.sensor_data ?? '')
  const summaries = usage?.sensor_data.removable_summaries ?? 0
  const audit = removal(usage?.audit_log.removable_lines, 'audit log lines', usage?.cleanup_at.audit_log ?? '')
  const removes = dirty && (sensor.removes || audit.removes || summaries > 0)

  const saveLimits = () =>
    save.mutate(
      { iot_data_retention_days: sensorDays, audit_log_retention_days: auditDays },
      {
        onSuccess: () => {
          setSensorEdit(null)
          setAuditEdit(null)
          queryClient.invalidateQueries({ queryKey: ['data_usage'] })
        },
      },
    )

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Data Retention" description="What your data takes up, how long it is kept, and what the nightly cleanup deletes" />

      {isError && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          The figures could not be loaded. Try again in a moment.
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">What your data takes up</h3>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <HardDrive className="h-4 w-4" aria-hidden="true" />
              <span>{usage ? `${formatBytes(usage.database_bytes)} database` : '…'}</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {usage && TABLE_LABELS.map(([key, label]) => (
                <tr key={key}>
                  <td className="py-2 text-gray-700 dark:text-gray-300">{label}</td>
                  <td className="py-2 text-right text-gray-500">
                    {key === 'sensor_readings' ? 'about ' : ''}{formatNumber(usage.tables[key].rows)} rows
                  </td>
                  <td className="py-2 text-right font-mono text-xs text-gray-700 dark:text-gray-300">{formatBytes(usage.tables[key].bytes)}</td>
                </tr>
              ))}
              {usage && (
                <tr>
                  <td className="py-2 text-gray-700 dark:text-gray-300">Uploaded files (photos, documents)</td>
                  <td className="py-2 text-right text-gray-500">{formatNumber(usage.attachments.count)} files</td>
                  <td className="py-2 text-right font-mono text-xs text-gray-700 dark:text-gray-300">{formatBytes(usage.attachments.bytes)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            These are the sizes in the database and the file storage as they are now. FixFlow does not know how big your disk is.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">How long data is kept</h3>

          <Policy label="Sensor readings and their hourly summaries"
            hint="A reading that raised an IoT alert is always kept, as the alert's evidence.">
            <select aria-label="Keep sensor readings for" className={SELECT} disabled={sensorDays === undefined} value={sensorDays ?? ''}
              onChange={(e) => setSensorEdit(Number(e.target.value))}>
              {sensorDays !== undefined && withCurrent(SENSOR_CHOICES, sensorDays).map((days) => (
                <option key={days} value={days}>{describeDays(days)}</option>
              ))}
            </select>
          </Policy>
          <p role="status" className={sensor.removes ? 'text-xs text-amber-700 dark:text-amber-400' : 'text-xs text-gray-500'}>
            {sensor.text}{summaries > 0 && sensor.removes ? ` (and ${formatNumber(summaries)} hourly summaries)` : ''}
            {usage?.sensor_data.oldest_at && ` The oldest reading is from ${formatDate(usage.sensor_data.oldest_at)}.`}
          </p>

          <Policy label="Audit log" hint="Who created, changed or deleted what. Keeping it for ever is the safe choice.">
            <select aria-label="Keep the audit log for" className={SELECT} disabled={auditDays === undefined} value={auditDays ?? ''}
              onChange={(e) => setAuditEdit(Number(e.target.value))}>
              {auditDays !== undefined && withCurrent(AUDIT_CHOICES, auditDays).map((days) => (
                <option key={days} value={days}>{describeDays(days, true)}</option>
              ))}
            </select>
          </Policy>
          <p role="status" className={audit.removes ? 'text-xs text-amber-700 dark:text-amber-400' : 'text-xs text-gray-500'}>
            {usage?.audit_log.checked_days === null ? 'The audit log is kept for ever, so nothing is deleted.' : audit.text}
            {usage?.audit_log.oldest_at && ` The oldest line is from ${formatDate(usage.audit_log.oldest_at)}.`}
          </p>

          <p className="text-xs text-gray-500">
            Everything else (work orders, assets, IoT alerts, comments, uploaded files) is kept until someone deletes it.
            {usage && ` The cleanup runs every night: sensor data at ${usage.cleanup_at.sensor_data}, the audit log at ${usage.cleanup_at.audit_log}.`}
          </p>

          {removes && (
            <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Saving will make the next nightly cleanup delete the data described above, for good. It cannot be undone.
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty || save.isPending} onClick={saveLimits}>
              {removes ? 'Save, and delete older data tonight' : 'Save retention limits'}
            </Button>
            {dirty && <Button size="sm" variant="outline" onClick={() => { setSensorEdit(null); setAuditEdit(null) }}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Database backups</h3>
          {usage && (usage.backups.runs ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A copy of the database is made every night at {usage.backups.at} and kept for {usage.backups.keep_days} days in the
              file storage (the <span className="font-mono">{usage.backups.bucket}</span> bucket). A failed backup is written to the server log only; nobody is told.
            </p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This server does not make backups: only a production server does (nightly at {usage.backups.at}, kept {usage.backups.keep_days} days).
            </p>
          ))}
          <p className="text-xs text-gray-500">
            Listing, downloading and restoring backups from this page is not available yet. The files are in the storage bucket named above.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
