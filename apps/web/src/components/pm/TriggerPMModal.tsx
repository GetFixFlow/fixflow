import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTriggerPM } from '@/hooks/usePreventiveMaintenance'
import type { PreventiveMaintenance } from '@/types'

interface TriggerPMModalProps { open: boolean; onClose: () => void; pm: PreventiveMaintenance }

export function TriggerPMModal({ open, onClose, pm }: TriggerPMModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [overrideAssignee, setOverrideAssignee] = useState('')
  const [overrideDueDate, setOverrideDueDate] = useState('')
  const [overridePriority, setOverridePriority] = useState('')
  const [note, setNote] = useState('')
  const trigger = useTriggerPM()

  const title = pm.title_template ?? pm.name ?? pm.title
  const defaultDue = pm.next_due_at ?? pm.next_due_date
  const steps = pm.checklist_template ?? []

  const handleSubmit = () => {
    const overrides: Record<string, unknown> = {}
    if (overrideAssignee) overrides.assignee_id = parseInt(overrideAssignee)
    if (overrideDueDate) overrides.due_date = overrideDueDate
    if (overridePriority) overrides.priority = overridePriority
    if (note) overrides.note = note
    trigger.mutate({ id: pm.id, overrides: Object.keys(overrides).length > 0 ? overrides : undefined }, { onSuccess: onClose })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">Trigger PM Now</Dialog.Title>
            <Dialog.Close asChild><button className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button></Dialog.Close>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-1.5 text-sm mb-4">
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">Work Order Preview</p>
            <div className="flex justify-between"><span className="text-gray-500">Title</span><span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[60%]">{title}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className="capitalize">{pm.priority}</span></div>
            {pm.assignee && <div className="flex justify-between"><span className="text-gray-500">Assign to</span><span>{pm.assignee.full_name}</span></div>}
            {defaultDue && <div className="flex justify-between"><span className="text-gray-500">Due date</span><span>{format(new Date(defaultDue), 'MMM d, yyyy')}</span></div>}
            {pm.estimated_hours && <div className="flex justify-between"><span className="text-gray-500">Est. Hours</span><span>{pm.estimated_hours}</span></div>}
            {steps.length > 0 && <div className="flex justify-between"><span className="text-gray-500">Checklist</span><span>{steps.length} steps</span></div>}
          </div>

          <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Advanced overrides
          </button>

          {showAdvanced && (
            <div className="space-y-2 mb-4">
              <div>
                <label className="text-xs text-gray-500">Override due date</label>
                <Input type="date" value={overrideDueDate} onChange={(e) => setOverrideDueDate(e.target.value)} className="mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Override priority</label>
                <select value={overridePriority} onChange={(e) => setOverridePriority(e.target.value)} className="mt-0.5 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Use default</option>
                  {['critical','high','medium','low'].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Add note to work order</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-0.5 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" placeholder="Optional note..." />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} loading={trigger.isPending} className="flex-1">
              <Zap className="h-4 w-4 mr-1.5" />Create Work Order Now
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
