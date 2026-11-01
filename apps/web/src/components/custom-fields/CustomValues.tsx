import { activeFields, useCustomFields } from '@/hooks/useCustomFields'
import { shownValue } from '@/lib/customFields'
import type { CustomFieldEntity, CustomValues as Values } from '@/types/customFields'

/** What was filled in for the company's custom fields on a record, as a list. Nothing when no field has a value. */
export function CustomValues({ entity, values, title = 'More details' }: { entity: CustomFieldEntity; values?: Values; title?: string }) {
  const { data } = useCustomFields(entity)
  const rows = activeFields(data)
    .map((field) => ({ field, text: shownValue(field, values?.[field.key]) }))
    .filter((row) => row.text !== '')

  if (rows.length === 0) return null

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(({ field, text }) => (
          <div key={field.key}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{field.label}</dt>
            <dd className="mt-0.5 break-words text-sm text-gray-900 dark:text-gray-100">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
