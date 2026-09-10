import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LocationSelect } from '@/components/shared/LocationSelect'
import { useCreateLocation, useUpdateLocation } from '@/hooks/useLocations'
import type { Location, LocationType } from '@/types'

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    location_type: z.enum(['site', 'building', 'floor', 'room', 'zone'] as const),
    parent_id: z.number().nullable().optional(),
    description: z.string().max(500).optional(),
  })
  .refine(
    (d) => d.location_type === 'site' || d.parent_id != null,
    { message: 'Parent location is required for non-site locations', path: ['parent_id'] },
  )

type FormValues = z.infer<typeof schema>

interface LocationFormModalProps {
  open: boolean
  onClose: () => void
  locations: Location[]
  location?: Location | null
  defaultParentId?: number | null
}

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'site', label: 'Site' },
  { value: 'building', label: 'Building' },
  { value: 'floor', label: 'Floor' },
  { value: 'room', label: 'Room' },
  { value: 'zone', label: 'Zone' },
]

export function LocationFormModal({
  open,
  onClose,
  locations,
  location,
  defaultParentId,
}: LocationFormModalProps) {
  const isEdit = !!location
  const createMutation = useCreateLocation()
  const updateMutation = useUpdateLocation(location?.id ?? 0)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      location_type: 'site',
      parent_id: defaultParentId ?? null,
      description: '',
    },
  })

  useEffect(() => {
    if (location) {
      reset({
        name: location.name,
        location_type: location.location_type,
        parent_id: location.parent_id ?? null,
        description: location.description ?? '',
      })
    } else {
      reset({
        name: '',
        location_type: 'site',
        parent_id: defaultParentId ?? null,
        description: '',
      })
    }
  }, [location, defaultParentId, reset])

  const locationType = watch('location_type')
  const parentId = watch('parent_id')

  const onSubmit = async (data: FormValues) => {
    const payload = {
      ...data,
      parent_id: data.location_type === 'site' ? null : data.parent_id,
    }
    if (isEdit) {
      await updateMutation.mutateAsync(payload)
    } else {
      await createMutation.mutateAsync(payload)
    }
    onClose()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Location' : 'Add Location'}
      description={isEdit ? 'Update location details.' : 'Create a new location in your hierarchy.'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="loc-name"
          label="Name *"
          placeholder="e.g. Building A"
          error={errors.name?.message}
          {...register('name')}
        />

        <div>
          <label
            htmlFor="loc-type"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Type *
          </label>
          <select
            id="loc-type"
            className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            {...register('location_type')}
          >
            {LOCATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {errors.location_type && (
            <p className="mt-1 text-xs text-red-600">{errors.location_type.message}</p>
          )}
        </div>

        {locationType !== 'site' && (
          <LocationSelect
            id="loc-parent"
            label="Parent Location *"
            locations={locations.filter((l) => l.id !== location?.id)}
            value={parentId ?? null}
            onChange={(id) => setValue('parent_id', id)}
            error={errors.parent_id?.message}
          />
        )}

        <Input
          id="loc-description"
          label="Description"
          placeholder="Optional description"
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? 'Save Changes' : 'Create Location'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
