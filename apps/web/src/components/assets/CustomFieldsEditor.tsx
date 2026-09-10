import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const FIELD_SUGGESTIONS = [
  'manufacturer',
  'model',
  'year',
  'supplier',
  'warranty_notes',
  'part_number',
  'voltage',
  'amperage',
  'weight',
]

interface CustomFieldsEditorProps {
  value: Record<string, string>
  onChange: (fields: Record<string, string>) => void
}

export function CustomFieldsEditor({ value, onChange }: CustomFieldsEditorProps) {
  const [entries, setEntries] = useState<{ key: string; val: string }[]>(() =>
    Object.entries(value).map(([key, val]) => ({ key, val })),
  )

  const sync = (next: { key: string; val: string }[]) => {
    setEntries(next)
    const result: Record<string, string> = {}
    for (const { key, val } of next) {
      if (key.trim()) result[key.trim()] = val
    }
    onChange(result)
  }

  const addField = () => sync([...entries, { key: '', val: '' }])

  const removeField = (index: number) => sync(entries.filter((_, i) => i !== index))

  const updateField = (index: number, field: 'key' | 'val', newValue: string) => {
    const next = entries.map((e, i) => (i === index ? { ...e, [field]: newValue } : e))
    sync(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Fields</span>
        <Button type="button" size="sm" variant="outline" onClick={addField}>
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">No custom fields yet.</p>
      )}

      <div className="space-y-2">
        {entries.map(({ key, val }, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={key}
                onChange={(e) => updateField(index, 'key', e.target.value)}
                placeholder="Field name"
                list="field-suggestions"
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                aria-label={`Custom field ${index + 1} key`}
              />
              <datalist id="field-suggestions">
                {FIELD_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <input
              type="text"
              value={val}
              onChange={(e) => updateField(index, 'val', e.target.value)}
              placeholder="Value"
              className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              aria-label={`Custom field ${index + 1} value`}
            />
            <button
              type="button"
              onClick={() => removeField(index)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
              aria-label={`Remove field ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
