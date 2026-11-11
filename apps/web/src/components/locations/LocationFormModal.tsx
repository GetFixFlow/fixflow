import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LocationSelect } from '@/components/shared/LocationSelect'
import { useCreateLocation, useUpdateLocation } from '@/hooks/useLocations'
import type { Location, LocationType } from '@/types'

const schema = z
  .object({
    name: z.string().min(2, 'assets.locations.name_min').max(100),
    location_type: z.enum(['site', 'building', 'floor', 'room', 'zone', 'outdoor'] as const),
    parent_id: z.number().nullable().optional(),
    description: z.string().max(500).optional(),
  })
  .refine(
    (d) => d.location_type === 'site' || d.parent_id != null,
    { message: 'assets.locations.parent_required', path: ['parent_id'] },
  )

type FormValues = z.infer<typeof schema>

interface LocationFormModalProps {
  open: boolean
  onClose: () => void
  locations: Location[]
  location?: Location | null
  defaultParentId?: number | null
}

const LOCATION_TYPES: LocationType[] = ['site', 'building', 'floor', 'room', 'zone', 'outdoor']

export function LocationFormModal({
  open,
  onClose,
  locations,
  location,
  defaultParentId,
}: LocationFormModalProps) {
  const { t } = useTranslation()
  const msg = (message?: string) => (message ? t(message) : undefined)
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
      title={isEdit ? t('assets.locations.edit_title') : t('assets.locations.add_title')}
      description={isEdit ? t('assets.locations.edit_description') : t('assets.locations.add_description')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="loc-name"
          label={t('assets.locations.name_label')}
          placeholder={t('assets.locations.name_placeholder')}
          error={msg(errors.name?.message)}
          {...register('name')}
        />

        <div>
          <label
            htmlFor="loc-type"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('assets.locations.type_field')}
          </label>
          <select
            id="loc-type"
            className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            {...register('location_type')}
          >
            {LOCATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`assets.locations.type.${type}`)}
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
            label={t('assets.locations.parent_label')}
            locations={locations.filter((l) => l.id !== location?.id)}
            value={parentId ?? null}
            onChange={(id) => setValue('parent_id', id)}
            error={msg(errors.parent_id?.message)}
          />
        )}

        <Input
          id="loc-description"
          label={t('assets.locations.description')}
          placeholder={t('assets.locations.description_placeholder')}
          error={msg(errors.description?.message)}
          {...register('description')}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? t('assets.locations.save') : t('assets.locations.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
