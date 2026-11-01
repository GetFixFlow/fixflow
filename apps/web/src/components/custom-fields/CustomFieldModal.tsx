import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAddCustomField, useChangeCustomField } from '@/hooks/useCustomFields'
import { KIND_LABELS, type CustomField, type CustomFieldEntity, type CustomFieldKind } from '@/types/customFields'

interface CustomFieldModalProps {
  entity: CustomFieldEntity
  /** Editing this field; omit to add a new one. */
  field?: CustomField
  onClose: () => void
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

const ENTITY_NAMES: Record<CustomFieldEntity, string> = { work_order: 'work orders', part: 'parts' }

/** Adding a field, or changing one: its name, what it takes (only when new), its choices and where it shows. */
export function CustomFieldModal({ entity, field, onClose }: CustomFieldModalProps) {
  const add = useAddCustomField()
  const change = useChangeCustomField()

  const [label, setLabel] = useState(field?.label ?? '')
  const [kind, setKind] = useState<CustomFieldKind>(field?.kind ?? 'text')
  const [choices, setChoices] = useState((field?.options ?? []).join('\n'))
  const [required, setRequired] = useState(field?.required ?? false)
  const [inList, setInList] = useState(field?.in_list ?? false)
  const [problem, setProblem] = useState('')

  const options = choices.split('\n').map((line) => line.trim()).filter(Boolean)
  const pending = add.isPending || change.isPending

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (label.trim() === '') return setProblem('Give the field a name.')
    if (kind === 'select' && options.length === 0) return setProblem('Add at least one choice, one to a line.')
    setProblem('')

    const body = {
      label: label.trim(),
      options: kind === 'select' ? options : [],
      required: kind === 'checkbox' ? false : required,
      in_list: inList,
    }
    if (field) change.mutate({ id: field.id, changes: body }, { onSuccess: onClose })
    else add.mutate({ entity, kind, ...body }, { onSuccess: onClose })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={field ? 'Change field' : 'Add a field'}
      description={field ? 'The type cannot be changed. To use another type, delete the field and add it again.' : `Shown when someone fills in ${ENTITY_NAMES[entity]}.`}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input id="cf-label" label="Name *" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="Cost centre" />

        <div>
          <label htmlFor="cf-kind" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
          <select
            id="cf-kind"
            value={kind}
            disabled={!!field}
            onChange={(e) => setKind(e.target.value as CustomFieldKind)}
            className={SELECT_CLASS}
          >
            {(Object.keys(KIND_LABELS) as CustomFieldKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </div>

        {kind === 'select' && (
          <div>
            <label htmlFor="cf-choices" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Choices *</label>
            <textarea
              id="cf-choices"
              value={choices}
              onChange={(e) => setChoices(e.target.value)}
              rows={4}
              placeholder={'One to a line\nLow\nMedium\nHigh'}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            {field && <p className="mt-1 text-xs text-gray-500">Work already filled in with a choice you remove keeps it.</p>}
          </div>
        )}

        <div className="space-y-2">
          {kind !== 'checkbox' && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              Must be filled in
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={inList} onChange={(e) => setInList(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Show as a column in the list
          </label>
        </div>

        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={pending} className="flex-1">{pending ? 'Saving…' : field ? 'Save changes' : 'Add field'}</Button>
        </div>
      </form>
    </Modal>
  )
}
