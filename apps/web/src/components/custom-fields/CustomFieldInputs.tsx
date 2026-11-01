import { Input } from '@/components/ui/Input'
import type { CustomInputValues } from '@/lib/customFields'
import type { CustomField } from '@/types/customFields'

interface CustomFieldInputsProps {
  /** The fields that are on, in the order to show them. */
  fields: CustomField[]
  values: CustomInputValues
  onChange: (values: CustomInputValues) => void
  /** What to say under a field, by key. */
  errors?: Record<string, string>
  /** Makes the ids of the inputs different when two forms are on screen. */
  idPrefix?: string
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

/** One input for each custom field: text, number, date, a choice list or a yes/no box. */
export function CustomFieldInputs({ fields, values, onChange, errors = {}, idPrefix = 'cf' }: CustomFieldInputsProps) {
  const set = (key: string, value: string | boolean) => onChange({ ...values, [key]: value })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.key}`
        const label = field.required ? `${field.label} *` : field.label
        const error = errors[field.key]
        const value = values[field.key]

        if (field.kind === 'checkbox') {
          return (
            <label key={field.key} htmlFor={id} className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                id={id}
                type="checkbox"
                checked={value === true}
                onChange={(e) => set(field.key, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              {field.label}
            </label>
          )
        }

        if (field.kind === 'select') {
          return (
            <div key={field.key}>
              <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
              <select
                id={id}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => set(field.key, e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">{field.required ? 'Choose…' : '—'}</option>
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                {/* A choice that was removed since this record was filled in stays selectable until it is changed. */}
                {typeof value === 'string' && value !== '' && !field.options.includes(value) && <option value={value}>{value}</option>}
              </select>
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            </div>
          )
        }

        return (
          <Input
            key={field.key}
            id={id}
            label={label}
            type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
            step={field.kind === 'number' ? 'any' : undefined}
            maxLength={field.kind === 'text' ? 500 : undefined}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => set(field.key, e.target.value)}
            error={error}
          />
        )
      })}
    </div>
  )
}
