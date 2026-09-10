import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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

const schema = z.object({
  name: z.string().min(2).max(100),
  asset_tag: z.string().max(50).optional(),
  serial_number: z.string().max(100).optional(),
  status: z.enum(['operational', 'degraded', 'down', 'decommissioned', 'maintenance', 'offline', 'retired'] as const),
  location_id: z.number().nullable().optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year_manufactured: z.coerce.number().min(1900).max(new Date().getFullYear()).optional().or(z.literal('')),
  purchase_date: z.string().optional(),
  warranty_expiry: z.string().optional(),
  description: z.string().max(1000).optional(),
  custom_fields: z.record(z.string()).optional(),
})

type FormValues = z.infer<typeof schema>

const STATUS_OPTIONS: AssetStatus[] = [
  'operational', 'degraded', 'down', 'decommissioned', 'maintenance', 'offline', 'retired',
]

export function AssetEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const assetId = parseInt(id ?? '0', 10)

  const { data: asset, isLoading } = useAsset(assetId)
  const { data: locationsData } = useLocations()
  const locations = locationsData ?? []
  const updateMutation = useUpdateAsset(assetId)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (asset) {
      reset({
        name: asset.name,
        asset_tag: asset.asset_tag,
        serial_number: asset.serial_number ?? '',
        status: asset.status,
        location_id: asset.location_id ?? null,
        manufacturer: asset.manufacturer ?? '',
        model: asset.model ?? '',
        year_manufactured: asset.year_manufactured ?? '',
        purchase_date: asset.purchase_date ?? '',
        warranty_expiry: asset.warranty_expiry ?? '',
        description: asset.description ?? '',
        custom_fields: asset.custom_fields ?? {},
      })
    }
  }, [asset, reset])

  const onSubmit = async (data: FormValues) => {
    await updateMutation.mutateAsync({
      ...data,
      year_manufactured: data.year_manufactured ? Number(data.year_manufactured) : undefined,
      location_id: data.location_id ?? null,
    })
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
        <p className="text-sm text-gray-500">Asset not found.</p>
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

      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Asset</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Basic Information
            </h2>
            <Input
              id="name"
              label="Asset Name *"
              error={errors.name?.message}
              {...register('name')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="asset-tag"
                label="Asset Tag"
                error={errors.asset_tag?.message}
                {...register('asset_tag')}
              />
              <Input
                id="serial-number"
                label="Serial Number"
                {...register('serial_number')}
              />
            </div>
            <div>
              <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status *
              </label>
              <select
                id="status"
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                {...register('status')}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <Input
              id="description"
              label="Description"
              {...register('description')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Location & Classification
            </h2>
            <LocationSelect
              id="location"
              label="Location"
              locations={locations}
              value={watch('location_id') ?? null}
              onChange={(id) => setValue('location_id', id, { shouldDirty: true })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input id="manufacturer" label="Manufacturer" {...register('manufacturer')} />
              <Input id="model" label="Model" {...register('model')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input id="year" label="Year" type="number" {...register('year_manufactured')} />
              <Input id="purchase-date" label="Purchase Date" type="date" {...register('purchase_date')} />
              <Input id="warranty" label="Warranty Expiry" type="date" {...register('warranty_expiry')} />
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
            Cancel
          </Button>
          <Button type="submit" loading={updateMutation.isPending} disabled={!isDirty}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  )
}
