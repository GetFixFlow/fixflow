import { t } from '@/i18n'
import { formatDate } from '@/lib/localeFormat'
import type { CustomField, CustomValues } from '@/types/customFields'

/** What the inputs hold while a form is open: text for everything but a yes/no box. */
export type CustomInputValues = Record<string, string | boolean>

/** The stored values as the inputs hold them. */
export function toInputValues(values: CustomValues | undefined): CustomInputValues {
  return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value)]))
}

/**
 * What to send for the fields shown. An empty input is sent as an empty string, which clears the field; a yes/no box
 * nobody touched is sent empty too, so it stays unset instead of becoming "no".
 */
export function toPayload(fields: CustomField[], values: CustomInputValues): Record<string, string | boolean> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = values[field.key]
      if (field.kind === 'checkbox') return [field.key, typeof value === 'boolean' ? value : '']
      return [field.key, typeof value === 'string' ? value.trim() : '']
    }),
  )
}

/** The required fields that have nothing in them, by key, with what to tell the person. */
export function missingRequired(fields: CustomField[], values: CustomInputValues): Record<string, string> {
  const missing: Record<string, string> = {}
  for (const field of fields) {
    if (!field.required) continue
    const value = values[field.key]
    if (typeof value !== 'string' || value.trim() === '') missing[field.key] = t('workOrders.custom.required', { label: field.label })
  }
  return missing
}

/** A stored value as a person reads it. */
export function shownValue(field: CustomField, value: CustomValues[string] | undefined): string {
  if (value === undefined || value === null || value === '') return ''
  if (field.kind === 'checkbox') return value ? t('common.state.yes') : t('common.state.no')
  if (field.kind === 'date') return formatDate(String(value))
  return String(value)
}
