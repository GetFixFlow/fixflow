import { useState } from 'react'
import { GripVertical, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { PMChecklistStep } from '@/types'

interface SortableStepProps {
  step: PMChecklistStep
  onUpdate: (step: PMChecklistStep) => void
  onDelete: () => void
  onEnterOnInstruction: () => void
  isLast: boolean
}

function SortableStep({ step, onUpdate, onDelete, onEnterOnInstruction }: SortableStepProps) {
  const [expanded, setExpanded] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.step })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2">
      <button {...attributes} {...listeners} className="mt-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500" aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="mt-1 text-xs text-gray-400 w-5 shrink-0">{step.step}</span>
      <div className="flex-1 space-y-1.5">
        <textarea
          className="w-full resize-none rounded border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
          rows={2}
          placeholder="Step instruction..."
          value={step.instruction}
          onChange={(e) => onUpdate({ ...step, instruction: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnterOnInstruction() } }}
        />
        {expanded && (
          <div className="space-y-1.5">
            <textarea
              className="w-full resize-none rounded border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 text-xs text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              rows={2}
              placeholder="Notes for technician (optional)..."
              value={step.notes ?? ''}
              onChange={(e) => onUpdate({ ...step, notes: e.target.value || undefined })}
            />
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="number" min={1} value={step.estimated_minutes ?? ''} onChange={(e) => onUpdate({ ...step, estimated_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-14 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-xs focus:outline-none" placeholder="mins" />
                Est. minutes
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={step.photo_required ?? false} onChange={(e) => onUpdate({ ...step, photo_required: e.target.checked })} className="rounded" />
                Photo required
              </label>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onUpdate({ ...step, required: !step.required })}
          className={cn('rounded-full px-2 py-0.5 text-xs font-medium transition-colors', step.required ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400')}
        >
          {step.required ? 'Required*' : 'Optional'}
        </button>
        <button type="button" onClick={() => setExpanded((e) => !e)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Expand step">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => { if (!step.instruction || window.confirm('Delete this step?')) onDelete() }}
          className="text-gray-300 hover:text-red-500 p-1" aria-label="Delete step"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

interface ChecklistTemplateBuilderProps {
  value: PMChecklistStep[]
  onChange: (steps: PMChecklistStep[]) => void
}

export function ChecklistTemplateBuilder({ value, onChange }: ChecklistTemplateBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const MAX_STEPS = 50

  const renumber = (steps: PMChecklistStep[]): PMChecklistStep[] => steps.map((s, i) => ({ ...s, step: i + 1 }))

  const addStep = () => {
    if (value.length >= MAX_STEPS) return
    onChange(renumber([...value, { step: value.length + 1, instruction: '', required: true }]))
  }

  const updateStep = (idx: number, updated: PMChecklistStep) => {
    const next = [...value]
    next[idx] = updated
    onChange(next)
  }

  const deleteStep = (idx: number) => onChange(renumber(value.filter((_, i) => i !== idx)))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = value.findIndex((s) => s.step === active.id)
    const newIdx = value.findIndex((s) => s.step === over.id)
    onChange(renumber(arrayMove(value, oldIdx, newIdx)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Checklist Steps</p>
        <span className="text-xs text-gray-400">{value.length}/{MAX_STEPS}</span>
      </div>

      {value.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 py-6 text-center text-sm text-gray-400">
          No steps yet. Add your first checklist step.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map((s) => s.step)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {value.map((step, idx) => (
              <SortableStep
                key={step.step}
                step={step}
                onUpdate={(updated) => updateStep(idx, updated)}
                onDelete={() => deleteStep(idx)}
                onEnterOnInstruction={addStep}
                isLast={idx === value.length - 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" size="sm" onClick={addStep} disabled={value.length >= MAX_STEPS} className="w-full">
        <Plus className="h-4 w-4 mr-1" />Add Step
      </Button>
    </div>
  )
}
