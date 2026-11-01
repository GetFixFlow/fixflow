import type { CustomField } from '@/types/customFields'

let next = 1

/** A custom field as the server sends it; say what differs. */
export function customField(extra: Partial<CustomField> = {}): CustomField {
  const id = next++
  const label = extra.label ?? `Field ${id}`
  return {
    id,
    entity: 'work_order',
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    label,
    kind: 'text',
    options: [],
    required: false,
    in_list: false,
    active: true,
    position: id,
    ...extra,
  }
}
