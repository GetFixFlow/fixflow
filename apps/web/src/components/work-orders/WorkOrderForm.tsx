import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LocationSelect } from '@/components/shared/LocationSelect'
import { AssetSelect } from '@/components/assets/AssetSelect'
import type { WorkOrder, Priority } from '@/types'

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low'] as const),
  asset_id: z.number({ error: 'Asset is required' }),
  due_date: z.string().optional(),
  estimated_hours: z.number().positive().optional(),
  assignee_id: z.number().optional(),
  initial_comment: z.string().optional(),
})

export type WorkOrderFormValues = z.infer<typeof schema>

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'critical', label: '🔴 Critical', color: 'border-red-400 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-300' },
  { value: 'high', label: '🟠 High', color: 'border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-600 dark:bg-orange-900/20 dark:text-orange-300' },
  { value: 'medium', label: '🟡 Medium', color: 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300' },
  { value: 'low', label: '🔵 Low', color: 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300' },
]

interface WorkOrderFormProps {
  defaultValues?: Partial<WorkOrderFormValues>
  onSubmit: (values: WorkOrderFormValues) => Promise<void>
  isLoading?: boolean
  mode?: 'create' | 'edit'
  lockedAssetId?: number
  onCancel?: () => void
}

export function WorkOrderForm({
  defaultValues,
  onSubmit,
  isLoading,
  mode = 'create',
  lockedAssetId,
  onCancel,
}: WorkOrderFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<WorkOrderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'medium',
      ...defaultValues,
      ...(lockedAssetId ? { asset_id: lockedAssetId } : {}),
    },
  })

  const priority = watch('priority')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* What needs fixing */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          What needs fixing?
        </h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title *
          </label>
          <Input
            {...register('title')}
            placeholder="Describe the issue..."
            className={errors.title ? 'border-red-400' : ''}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={4}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="Additional details..."
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Priority *
          </label>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue('priority', opt.value, { shouldDirty: true })}
                className={cn(
                  'rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all',
                  priority === opt.value
                    ? opt.color
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Which asset */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Which asset?
        </h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Asset *
          </label>
          {lockedAssetId ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pre-filled from asset detail page (ID: {lockedAssetId})
            </p>
          ) : (
            <Controller
              name="asset_id"
              control={control}
              render={({ field }) => (
                <AssetSelect
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id)}
                />
              )}
            />
          )}
          {errors.asset_id && (
            <p className="mt-1 text-xs text-red-500">{errors.asset_id.message}</p>
          )}
        </div>
      </section>

      {/* Who & When */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Who &amp; When?
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Due Date
            </label>
            <Input
              type="datetime-local"
              {...register('due_date')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Estimated Hours
            </label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              {...register('estimated_hours', { valueAsNumber: true })}
              placeholder="e.g. 2.0"
            />
          </div>
        </div>
      </section>

      {/* Additional */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Additional
        </h2>

        {mode === 'create' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Initial Comment
            </label>
            <textarea
              {...register('initial_comment')}
              rows={3}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Any additional context for the technician..."
            />
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading || (mode === 'edit' && !isDirty)}
          loading={isLoading}
        >
          {mode === 'create' ? 'Create Work Order' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
