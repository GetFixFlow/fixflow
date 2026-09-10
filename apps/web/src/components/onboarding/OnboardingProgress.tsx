import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OnboardingProgressProps {
  currentStep: number
  totalSteps: number
  labels?: string[]
}

export function OnboardingProgress({ currentStep, totalSteps, labels }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const done = step < currentStep
        const active = step === currentStep
        return (
          <div key={step} className="flex items-center">
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
              done
                ? 'bg-brand-600 text-white'
                : active
                  ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                  : 'bg-gray-200 text-gray-500',
            )}>
              {done ? <Check className="h-4 w-4" /> : step}
            </div>
            {labels && (
              <span className={cn(
                'hidden sm:block ml-1.5 text-xs mr-1',
                active ? 'text-brand-600 font-medium' : 'text-gray-400',
              )}>
                {labels[i]}
              </span>
            )}
            {step < totalSteps && (
              <div className={cn(
                'h-0.5 w-8 sm:w-12',
                step < currentStep ? 'bg-brand-600' : 'bg-gray-200',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
