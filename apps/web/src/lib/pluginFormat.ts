import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/localeFormat'
import type { PluginColumnKind } from '@/api/plugins'

/** A value as the company's settings show it. The plugin sends numbers as numbers and dates as ISO text, never as sentences. */
export function formatCell(value: string | number | null, kind: PluginColumnKind): string {
  if (value === null || value === '') return '—'
  switch (kind) {
    case 'number': return typeof value === 'number' ? formatNumber(value, Number.isInteger(value) ? 0 : 2) : String(value)
    case 'money': return formatMoney(value)
    case 'percent': return typeof value === 'number' ? `${formatNumber(value, Number.isInteger(value) ? 0 : 1)}%` : String(value)
    case 'date': return formatDate(String(value))
    case 'datetime': return formatDateTime(String(value))
    default: return String(value)
  }
}
