import type { AuditLine } from '@/api/audit'

/** What the audit log calls each kind of record, for the "what" filter and the table. */
export const RECORD_TYPES: Record<string, string> = {
  WorkOrder: 'Work order',
  Asset: 'Asset',
  Location: 'Location',
  PreventiveMaintenance: 'PM schedule',
  IotRule: 'IoT rule',
  ApiKey: 'API key',
  User: 'Person',
  Part: 'Part',
  Organization: 'Company',
}

/** The verbs the "what happened" filter offers; the server matches the end of the action ("asset.created"). */
export const VERBS: Record<string, string> = {
  created: 'Created',
  updated: 'Changed',
  deleted: 'Deleted',
  restored: 'Restored',
  revoked: 'Revoked',
  deactivated: 'Deactivated',
  reactivated: 'Reactivated',
  signed_in: 'Signed in',
}

const SPECIAL: Record<string, string> = {
  'branding.updated': 'Branding changed',
  'localization_settings.updated': 'Date, time and currency settings changed',
  'organization_settings.updated': 'Company settings changed',
  'email_settings.updated': 'Email settings changed',
  'email_settings.removed': 'Email settings removed',
  'sample_data.loaded': 'Example data loaded',
  'sample_data.removed': 'Example data removed',
  'session.revoked': 'Signed-in device ended',
  'session.revoked_all': 'All other signed-in devices ended',
  'user.signed_in': 'Signed in',
  'part.stock_adjusted': 'Part stock adjusted',
  'retention.sensor_data_removed': 'Old sensor data deleted',
  'retention.audit_log_removed': 'Old audit log lines deleted',
  'backup.downloaded': 'Database backup downloaded',
  'backup.failed': 'Nightly backup failed',
}

const words = (text: string) => text.replace(/_/g, ' ')
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "asset.created" → "Asset created", "import.parts" → "Imported parts", "work_order.put_on_hold" → "Work order put on hold". */
export function describeAction(action: string): string {
  if (SPECIAL[action]) return SPECIAL[action]
  const [kind, verb = ''] = action.split('.')
  if (kind === 'import') return `Imported ${words(verb)}`
  const label = RECORD_TYPES[kind.split('_').map((part) => sentence(part)).join('')] ?? sentence(words(kind))
  return verb ? `${label} ${words(verb)}` : label
}

/** The fields that changed, as the log has them (it keeps their names, not their values). */
export function changedFields(line: AuditLine): string[] {
  const { changed, changes } = line.metadata
  if (Array.isArray(changed)) return changed.map(words)
  if (changes && typeof changes === 'object') return Object.keys(changes).map(words)
  return []
}

/** The one thing a line may say about a value: a role going from one to another. */
export function roleChange(line: AuditLine): string | null {
  const pair = line.metadata.values?.role
  return Array.isArray(pair) ? `${pair[0]} → ${pair[1]}` : null
}

/** What a retention cleanup removed ("1,200 readings, 30 hourly summaries, older than 1 year"), or null for any other line. */
export function removalSummary(line: AuditLine): string | null {
  if (!line.action.startsWith('retention.')) return null
  const { readings, summaries, lines, older_than_days: olderThan } = line.metadata as Record<string, unknown>
  const parts = [
    typeof readings === 'number' && readings > 0 ? `${readings.toLocaleString()} readings` : null,
    typeof summaries === 'number' && summaries > 0 ? `${summaries.toLocaleString()} hourly summaries` : null,
    typeof lines === 'number' && lines > 0 ? `${lines.toLocaleString()} lines` : null,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return `Deleted ${parts.join(', ')}${typeof olderThan === 'number' ? `, older than ${olderThan} days` : ''}`
}

/** Which backup was downloaded, or why the nightly one failed; null for any other line. */
export function backupSummary(line: AuditLine): string | null {
  const { name, error } = line.metadata as Record<string, unknown>
  if (line.action === 'backup.downloaded' && typeof name === 'string') return name
  if (line.action === 'backup.failed' && typeof error === 'string') return error
  return null
}
