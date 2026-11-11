import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { CustomFieldsEditor } from '@/components/assets/CustomFieldsEditor'
import { LocationSelect } from '@/components/shared/LocationSelect'
import { useAsset, useUpdateAsset } from '@/hooks/useAssets'
import { useLocations } from '@/hooks/useLocations'
import type { AssetStatus } from '@/types'
import { label } from '@/i18n'

const schema = z.object({
  name: z.string().min(2, 'assets.create.name_min').max(100),
  asset_tag: z.string().max(50).optional(),
  serial_number: z.string().max(100).optional(),
  barcode: z.string().max(64).optional(),
  status: z.enum(['operational', 'degraded', 'down', 'decommissioned'] as const),
  location_id: z.number().nullable().optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year_manufactured: z.coerce.number().min(1900).max(new Date().getFullYear()).optional().or(z.literal('')),
  purchase_date: z.string().optional(),
  warranty_expires_on: z.string().optional(),
  description: z.string().max(1000).optional(),
  custom_fields: z.record(z.string(), z.string()).optional(),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

const STATUS_OPTIONS: AssetStatus[] = [
  'operational', 'degraded', 'down', 'decommissioned',
]

export function AssetEditPage() {
  const { t } = useTranslation()
  /** A message from a form rule is the key of its text. */
  const msg = (message?: string) => (message ? t(message) : undefined)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const assetId = parseInt(id ?? '0', 10)

  const { data: asset, isLoading } = useAsset(assetId)
  const { data: locationsData } = useLocations()
  const locations = locationsData ?? []
  const updateMutation = useUpdateAsset(assetId)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (asset) {
      reset({
        name: asset.name,
        asset_tag: asset.asset_tag,
        serial_number: asset.serial_number ?? '',
        barcode: asset.barcode ?? '',
        status: asset.status,
        location_id: asset.location_id ?? null,
        manufacturer: asset.manufacturer ?? '',
        model: asset.model ?? '',
        year_manufactured: asset.year_manufactured ?? '',
        purchase_date: asset.purchase_date ?? '',
        warranty_expires_on: asset.warranty_expires_on ?? '',
        description: asset.description ?? '',
        custom_fields: Object.fromEntries(Object.entries(asset.custom_fields ?? {}).map(([k, v]) => [k, String(v)])),
      })
    }
  }, [asset, reset])

  const onSubmit = async (data: FormValues) => {
    try {
      await updateMutation.mutateAsync({
        ...data,
        year_manufactured: data.year_manufactured ? Number(data.year_manufactured) : undefined,
        location_id: data.location_id ?? null,
      })
    } catch {
      return // the reason is already on screen (a barcode another asset has, say); stay here so it can be changed
    }
    navigate(`/assets/${assetId}`)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('assets.edit.not_found')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to={`/assets/${assetId}`}>
          <ArrowLeft className="h-4 w-4" />
          {asset.name}
        </Link>
      </Button>

      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('assets.edit.title')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('assets.edit.basic')}
            </h2>
            <Input
              id="name"
              label={t('assets.create.name_label')}
              error={msg(errors.name?.message)}
              {...register('name')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="asset-tag"
                label={t('assets.create.tag_label')}
                error={msg(errors.asset_tag?.message)}
                {...register('asset_tag')}
              />
              <Input
                id="serial-number"
                label={t('assets.create.serial_label')}
                {...register('serial_number')}
              />
            </div>
            <div>
              <Input
                id="barcode"
                label={t('assets.create.barcode_label')}
                placeholder={t('assets.edit.barcode_placeholder')}
                error={msg(errors.barcode?.message)}
                {...register('barcode')}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('assets.edit.barcode_help')}</p>
            </div>
            <div>
              <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('assets.create.status_label')}
              </label>
              <select
                id="status"
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                {...register('status')}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {label('status', s)}
                  </option>
                ))}
              </select>
            </div>
            <Input
              id="description"
              label={t('assets.edit.description')}
              {...register('description')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('assets.edit.location_heading')}
            </h2>
            <LocationSelect
              id="location"
              label={t('assets.edit.location')}
              locations={locations}
              value={watch('location_id') ?? null}
              onChange={(id) => setValue('location_id', id, { shouldDirty: true })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input id="manufacturer" label={t('assets.create.manufacturer')} {...register('manufacturer')} />
              <Input id="model" label={t('assets.create.model')} {...register('model')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input id="year" label={t('assets.edit.year')} type="number" {...register('year_manufactured')} />
              <Input id="purchase-date" label={t('assets.create.purchase_date')} type="date" {...register('purchase_date')} />
              <Input id="warranty" label={t('assets.create.warranty_expiry')} type="date" {...register('warranty_expires_on')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <CustomFieldsEditor
              value={watch('custom_fields') ?? {}}
              onChange={(fields) => setValue('custom_fields', fields, { shouldDirty: true })}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => navigate(`/assets/${assetId}`)}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" loading={updateMutation.isPending} disabled={!isDirty}>
            {t('assets.edit.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
