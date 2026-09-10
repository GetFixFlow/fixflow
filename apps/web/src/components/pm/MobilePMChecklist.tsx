import { useState } from 'react'
import { Camera, CheckCircle, Circle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { PMChecklistStep } from '@/types'

interface MobilePMChecklistProps {
  steps: PMChecklistStep[]
  completedStepNums: Set<number>
  onStepComplete: (stepNum: number, completed: boolean) => void
  onPhotoCapture?: (stepNum: number) => void
  onMarkComplete?: () => void
}

export function MobilePMChecklist({ steps, completedStepNums, onStepComplete, onPhotoCapture, onMarkComplete }: MobilePMChecklistProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const required = steps.filter((s) => s.required)
  const requiredCompleted = required.filter((s) => completedStepNums.has(s.step))
  const totalCompleted = steps.filter((s) => completedStepNums.has(s.step)).length
  const progress = steps.length > 0 ? Math.round((totalCompleted / steps.length) * 100) : 0
  const allRequiredDone = requiredCompleted.length === required.length

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-gray-700 dark:text-gray-300">{totalCompleted} of {steps.length} steps complete</span>
          <span className="text-gray-500">{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => {
          const isCompleted = completedStepNums.has(step.step)
          const isExpanded = expandedStep === step.step

          return (
            <div
              key={step.step}
              className={cn(
                'rounded-xl border transition-colors',
                isCompleted ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
              )}
            >
              <div
                className="flex items-start gap-3 p-4 cursor-pointer min-h-[56px]"
                onClick={() => setExpandedStep(isExpanded ? null : step.step)}
              >
                <button
                  className="shrink-0 mt-0.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!step.photo_required || isCompleted) {
                      onStepComplete(step.step, !isCompleted)
                    }
                  }}
                  aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isCompleted
                    ? <CheckCircle className="h-6 w-6 text-green-500" />
                    : <Circle className={cn('h-6 w-6', step.required ? 'text-red-400' : 'text-gray-300')} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium leading-snug', isCompleted && 'line-through text-gray-400 dark:text-gray-500', !isCompleted && 'text-gray-900 dark:text-gray-100')}>
                    {step.step}. {step.instruction}
                  </p>
                  {step.required && !isCompleted && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-red-500 mt-0.5">
                      <AlertCircle className="h-3 w-3" />Required
                    </span>
                  )}
                  {step.estimated_minutes && (
                    <span className="text-xs text-gray-400 ml-1">~{step.estimated_minutes} min</span>
                  )}
                </div>
                {step.photo_required && (
                  <Camera className={cn('h-5 w-5 shrink-0', isCompleted ? 'text-green-400' : 'text-orange-400')} />
                )}
              </div>

              {isExpanded && (step.notes || step.photo_required) && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                  {step.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{step.notes}</p>}
                  {step.photo_required && !isCompleted && (
                    <Button size="sm" variant="outline" onClick={() => { onPhotoCapture?.(step.step); onStepComplete(step.step, true) }} className="w-full">
                      <Camera className="h-4 w-4 mr-2" />Capture Photo to Complete
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-4 pt-2">
        <Button
          className="w-full h-14 text-base"
          disabled={!allRequiredDone}
          onClick={onMarkComplete}
          title={!allRequiredDone ? `Complete ${required.length - requiredCompleted.length} required step(s) first` : undefined}
        >
          {allRequiredDone ? '✅ Mark Work Order Complete' : `${required.length - requiredCompleted.length} required step(s) remaining`}
        </Button>
      </div>
    </div>
  )
}
