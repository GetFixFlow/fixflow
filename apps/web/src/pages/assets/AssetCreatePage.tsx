import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { AssetQRCode } from '@/components/assets/AssetQRCode'
import { AssetStatusBadge } from '@/components/assets/AssetStatusBadge'
import { LocationSelect } from '@/components/shared/LocationSelect'
import { useCreateAsset } from '@/hooks/useAssets'
import { useLocations } from '@/hooks/useLocations'
import { cn } from '@/lib/utils'
import type { AssetStatus } from '@/types'

const step1Schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  asset_tag: z.string().max(50).optional(),
  serial_number: z.string().max(100).optional(),
  status: z.enum(['operational', 'degraded', 'down', 'maintenance', 'offline'] as const),
})

const step2Schema = z.object({
  location_id: z.number().nullable().optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year_manufactured: z.coerce.number().min(1900).max(new Date().getFullYear()).optional().or(z.literal('')),
  purchase_date: z.string().optional(),
  warranty_expiry: z.string().optional(),
})

type Step1Values = z.infer<typeof step1Schema>
type Step2Values = z.infer<typeof step2Schema>

const STATUS_OPTIONS: AssetStatus[] = ['operational', 'degraded', 'down', 'maintenance', 'offline']

const STEPS = [
  { label: 'Basic Information', description: 'Name, tag, and status' },
  { label: 'Location & Details', description: 'Where and what it is' },
  { label: 'Review & Create', description: 'Confirm and save' },
]

export function AssetCreatePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const createMutation = useCreateAsset()
  const { data: locationsData } = useLocations()
  const locations = locationsData ?? []

  const [formData, setFormData] = useState<Step1Values & Step2Values>({
    name: '',
    asset_tag: '',
    serial_number: '',
    status: 'operational',
    location_id: null,
    manufacturer: '',
    model: '',
    year_manufactured: '',
    purchase_date: '',
    warranty_expiry: '',
  })

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: formData,
  })

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: formData,
  })

  const handleStep1 = step1Form.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, ...data }))
    setStep(2)
  })

  const handleStep2 = step2Form.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, ...data }))
    setStep(3)
  })

  const handleCreate = async () => {
    const payload = {
      name: formData.name,
      asset_tag: formData.asset_tag || undefined,
      serial_number: formData.serial_number || undefined,
      status: formData.status,
      location_id: formData.location_id ?? undefined,
      manufacturer: formData.manufacturer || undefined,
      model: formData.model || undefined,
      year_manufactured: formData.year_manufactured ? Number(formData.year_manufactured) : undefined,
      purchase_date: formData.purchase_date || undefined,
      warranty_expiry: formData.warranty_expiry || undefined,
    }
    const result = await createMutation.mutateAsync(payload)
    const newId = (result.data as { data?: { id?: number } }).data?.id
    if (newId) {
      setCreatedId(newId)
      navigate(`/assets/${newId}`)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/assets">
          <ArrowLeft className="h-4 w-4" />
          Assets
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create Asset</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Step {step} of {STEPS.length}: {STEPS[step - 1].description}
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const num = i + 1
          const done = step > num
          const active = step === num
          return (
            <div key={s.label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  done
                    ? 'bg-green-500 text-white'
                    : active
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : num}
              </div>
              <span className={cn('hidden text-xs sm:block', active ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-400')}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={cn('h-px flex-1', step > num ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700')} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
              Basic Information
            </h2>
            <form onSubmit={handleStep1} className="space-y-4">
              <Input
                id="asset-name"
                label="Asset Name *"
                placeholder="e.g. Pump-01"
                error={step1Form.formState.errors.name?.message}
                {...step1Form.register('name')}
              />
              <Input
                id="asset-tag"
                label="Asset Tag"
                placeholder="Auto-generated if empty (e.g. FF-000001)"
                error={step1Form.formState.errors.asset_tag?.message}
                {...step1Form.register('asset_tag')}
              />
              <Input
                id="serial-number"
                label="Serial Number"
                placeholder="e.g. SN-PUMP-001"
                {...step1Form.register('serial_number')}
              />
              <div>
                <label
                  htmlFor="asset-status"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Status *
                </label>
                <select
                  id="asset-status"
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  {...step1Form.register('status')}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                {step1Form.formState.errors.status && (
                  <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.status.message}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  Continue →
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
              Location & Classification
            </h2>
            <form onSubmit={handleStep2} className="space-y-4">
              <LocationSelect
                id="asset-location"
                label="Location *"
                locations={locations}
                value={step2Form.watch('location_id') ?? null}
                onChange={(id) => step2Form.setValue('location_id', id)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="manufacturer"
                  label="Manufacturer"
                  placeholder="e.g. Grundfos"
                  {...step2Form.register('manufacturer')}
                />
                <Input
                  id="model"
                  label="Model"
                  placeholder="e.g. CM5"
                  {...step2Form.register('model')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="year"
                  label="Year Manufactured"
                  type="number"
                  placeholder={String(new Date().getFullYear())}
                  {...step2Form.register('year_manufactured')}
                />
                <Input
                  id="purchase-date"
                  label="Purchase Date"
                  type="date"
                  {...step2Form.register('purchase_date')}
                />
              </div>
              <Input
                id="warranty-expiry"
                label="Warranty Expiry"
                type="date"
                {...step2Form.register('warranty_expiry')}
              />
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button type="submit">
                  Continue →
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 3 - Review */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                Review & Create
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-3">
                    <dt className="w-32 shrink-0 text-gray-500">Name</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">{formData.name}</dd>
                  </div>
                  {formData.asset_tag && (
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-gray-500">Asset Tag</dt>
                      <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">{formData.asset_tag}</dd>
                    </div>
                  )}
                  {formData.serial_number && (
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-gray-500">Serial No.</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formData.serial_number}</dd>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <dt className="w-32 shrink-0 text-gray-500">Status</dt>
                    <dd>
                      <AssetStatusBadge status={formData.status as AssetStatus} />
                    </dd>
                  </div>
                  {formData.manufacturer && (
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-gray-500">Manufacturer</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formData.manufacturer}</dd>
                    </div>
                  )}
                  {formData.model && (
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-gray-500">Model</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formData.model}</dd>
                    </div>
                  )}
                </dl>
                <div className="flex flex-col items-center">
                  <p className="mb-2 text-xs text-gray-500">Preview QR Code</p>
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
                    <div className="flex h-32 w-32 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
                      <p className="text-center text-xs text-gray-400">
                        QR generated
                        <br />
                        after creation
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
            >
              Create Asset
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
