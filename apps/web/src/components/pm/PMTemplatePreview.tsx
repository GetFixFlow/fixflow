import { CheckCircle, Circle, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { PreventiveMaintenance } from '@/types'

export function PMTemplatePreview({ pm, onEdit }: { pm: PreventiveMaintenance; onEdit?: () => void }) {
  const steps = pm.checklist_template ?? []
  const parts = pm.required_parts ?? []

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Work Order Template</h3>
          {onEdit && <Button variant="ghost" size="sm" onClick={onEdit}>Edit Template</Button>}
        </div>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500 mb-0.5">Title template</dt>
            <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
              {pm.title_template ?? pm.title ?? pm.name ?? '—'}
            </dd>
          </div>
          {pm.estimated_hours && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Estimated Hours</dt>
              <dd className="text-gray-900 dark:text-gray-100">{pm.estimated_hours} hrs</dd>
            </div>
          )}
          {pm.priority && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Default Priority</dt>
              <dd className="capitalize text-gray-900 dark:text-gray-100">{pm.priority}</dd>
            </div>
          )}
          {pm.assignee && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Default Assignee</dt>
              <dd className="text-gray-900 dark:text-gray-100">{pm.assignee.full_name}</dd>
            </div>
          )}
        </dl>

        {steps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Checklist Preview</p>
            <ul className="space-y-1">
              {steps.map((s) => (
                <li key={s.step} className="flex items-start gap-2 text-sm">
                  {s.required
                    ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    : <Circle className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />}
                  <span className="text-gray-700 dark:text-gray-300">
                    {s.instruction}
                    {s.required && <span className="ml-1 text-xs text-gray-400">(required)</span>}
                    {!s.required && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {parts.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Required Parts
            </p>
            <ul className="space-y-1">
              {parts.map((p, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {p.part?.name ?? `Part #${p.part_id}`}
                    {p.part?.part_number && <span className="ml-1 text-xs text-gray-400">({p.part.part_number})</span>}
                  </span>
                  <span className="text-gray-500">× {p.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
