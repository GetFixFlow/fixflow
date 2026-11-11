import { useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { CustomFieldModal } from '@/components/custom-fields/CustomFieldModal'
import {
  useChangeCustomField, useCustomFields, useDeleteCustomField, useReorderCustomFields,
} from '@/hooks/useCustomFields'
import { KIND_LABELS, type CustomField, type CustomFieldEntity } from '@/types/customFields'

const MAX_FIELDS = 20

const TABS: { entity: CustomFieldEntity; label: string }[] = [
  { entity: 'work_order', label: 'Work orders' },
  { entity: 'part', label: 'Parts' },
]

export function CustomFieldsPage() {
  const [entity, setEntity] = useState<CustomFieldEntity>('work_order')
  const [editing, setEditing] = useState<CustomField | 'new' | null>(null)

  const { data: fields, isLoading, isError, refetch } = useCustomFields(entity)
  const change = useChangeCustomField()
  const remove = useDeleteCustomField()
  const reorder = useReorderCustomFields()

  const list = fields ?? []
  const tabName = TABS.find((tab) => tab.entity === entity)!.label.toLowerCase()

  const move = (index: number, by: -1 | 1) => {
    const ids = list.map((field) => field.id)
    ;[ids[index], ids[index + by]] = [ids[index + by], ids[index]]
    reorder.mutate({ entity, ids })
  }

  const confirmDelete = (field: CustomField) => {
    if (!confirm(`Delete "${field.label}"? What was filled in for it on every ${entity === 'part' ? 'part' : 'work order'} is deleted too. To keep it, turn the field off instead.`)) return
    remove.mutate(field.id)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Custom Fields"
        description="Add your own fields to work orders and parts. They show on the forms, the work order page, the lists you choose and the work order export."
        actions={
          <Button size="sm" onClick={() => setEditing('new')} disabled={list.length >= MAX_FIELDS}>
            <Plus className="h-4 w-4" />Add field
          </Button>
        }
      />

      <div role="tablist" aria-label="Kind of record" className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.entity}
            role="tab"
            aria-selected={entity === tab.entity}
            onClick={() => setEntity(tab.entity)}
            className={
              entity === tab.entity
                ? '-mb-px border-b-2 border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 dark:text-brand-400'
                : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : isError ? (
        <EmptyState icon={ListPlus} title="The fields could not be loaded" action={{ label: 'Try again', onClick: () => refetch() }} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title={`No custom fields on ${tabName} yet`}
          description="Add what you need to know that FixFlow does not ask: a cost centre, a hazard class, a shelf."
          action={{ label: 'Add field', onClick: () => setEditing('new') }}
        />
      ) : (
        <>
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
            {list.map((field, index) => (
              <li key={field.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-[200px] flex-1">
                  <p className={field.active ? 'font-medium text-gray-900 dark:text-gray-100' : 'font-medium text-gray-500 dark:text-gray-400 line-through'}>{field.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {KIND_LABELS[field.kind]}
                    {field.kind === 'select' && `: ${field.options.join(', ')}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {field.required && <Badge variant="warning">Required</Badge>}
                  {field.in_list && <Badge variant="secondary">In list</Badge>}
                  {!field.active && <Badge variant="destructive">Off</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)} aria-label={`Move ${field.label} up`}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={index === list.length - 1 || reorder.isPending} onClick={() => move(index, 1)} aria-label={`Move ${field.label} down`}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(field)} aria-label={`Edit ${field.label}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => change.mutate({ id: field.id, changes: { active: !field.active } })}
                    aria-label={`${field.active ? 'Turn off' : 'Turn on'} ${field.label}`}
                    title={field.active ? 'Turn off: hidden, what was filled in is kept' : 'Turn on'}
                  >
                    {field.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => confirmDelete(field)} aria-label={`Delete ${field.label}`}>
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {list.length} of {MAX_FIELDS} fields. Turning a field off hides it and keeps what was filled in; deleting it deletes that too.
          </p>
        </>
      )}

      {editing && <CustomFieldModal entity={entity} field={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
