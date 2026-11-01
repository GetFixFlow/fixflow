export type CustomFieldEntity = 'work_order' | 'part'
export type CustomFieldKind = 'text' | 'number' | 'date' | 'select' | 'checkbox'

/** A field an administrator added to work orders or parts. */
export interface CustomField {
  id: number
  entity: CustomFieldEntity
  /** The name of the field inside a record's custom_values. Never changes. */
  key: string
  label: string
  kind: CustomFieldKind
  /** The choices of a choice list; empty for the other kinds. */
  options: string[]
  required: boolean
  /** Whether the lists show it as a column. */
  in_list: boolean
  /** A field that is turned off is hidden everywhere; what was filled in stays. */
  active: boolean
  position: number
}

/** What was filled in on a record, by field key. */
export type CustomValues = Record<string, string | number | boolean>

export const KIND_LABELS: Record<CustomFieldKind, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  select: 'Choice list',
  checkbox: 'Yes / no',
}
