import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { label } from '@/i18n'

const step1Schema = z.object({
  name: z.string().min(2, 'assets.create.name_min').max(100),
  asset_tag: z.string().max(50).optional(),
  serial_number: z.string().max(100).optional(),
  barcode: z.string().max(64).optional(),
  status: z.enum(['operational', 'degraded', 'down', 'decommissioned'] as const),
})

const step2Schema = z.object({
  location_id: z.number().nullable().optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year_manufactured: z.coerce.number().min(1900).max(new Date().getFullYear()).optional().or(z.literal('')),
  purchase_date: z.string().optional(),
  warranty_expires_on: z.string().optional(),
})

type Step1Values = z.infer<typeof step1Schema>
type Step2Values = z.output<typeof step2Schema>
type Step2Input = z.input<typeof step2Schema>

const STATUS_OPTIONS: AssetStatus[] = ['operational', 'degraded', 'down', 'decommissioned']

const STEPS = ['step1', 'step2', 'step3']

export function AssetCreatePage() {
  const { t } = useTranslation()
  /** A message from a form rule is the key of its text. */
  const msg = (message?: string) => (message ? t(message) : undefined)
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
    barcode: '',
    status: 'operational',
    location_id: null,
    manufacturer: '',
    model: '',
    year_manufactured: '',
    purchase_date: '',
    warranty_expires_on: '',
  })

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: formData,
  })

  const step2Form = useForm<Step2Input, unknown, Step2Values>({
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
      barcode: formData.barcode || undefined,
      status: formData.status,
      location_id: formData.location_id ?? undefined,
      manufacturer: formData.manufacturer || undefined,
      model: formData.model || undefined,
      year_manufactured: formData.year_manufactured ? Number(formData.year_manufactured) : undefined,
      purchase_date: formData.purchase_date || undefined,
      warranty_expires_on: formData.warranty_expires_on || undefined,
    }
    let result
    try {
      result = await createMutation.mutateAsync(payload)
    } catch {
      return // the reason is already on screen (a barcode another asset has, say); stay here so it can be changed
    }
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
          {t('assets.create.back_to_assets')}
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('assets.create.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('assets.create.step_of', { step, total: STEPS.length, description: t(`assets.create.${STEPS[step - 1]}_description`) })}
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const num = i + 1
          const done = step > num
          const active = step === num
          return (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  done
                    ? 'bg-green-700 text-white'
                    : active
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : num}
              </div>
              <span className={cn('hidden text-xs sm:block', active ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}>
                {t(`assets.create.${s}_label`)}
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
              {t('assets.create.step1_label')}
            </h2>
            <form onSubmit={handleStep1} className="space-y-4">
              <Input
                id="asset-name"
                label={t('assets.create.name_label')}
                placeholder={t('assets.create.name_placeholder')}
                error={msg(step1Form.formState.errors.name?.message)}
                {...step1Form.register('name')}
              />
              <Input
                id="asset-tag"
                label={t('assets.create.tag_label')}
                placeholder={t('assets.create.tag_placeholder')}
                error={msg(step1Form.formState.errors.asset_tag?.message)}
                {...step1Form.register('asset_tag')}
              />
              <Input
                id="serial-number"
                label={t('assets.create.serial_label')}
                placeholder={t('assets.create.serial_placeholder')}
                {...step1Form.register('serial_number')}
              />
              <Input
                id="barcode"
                label={t('assets.create.barcode_label')}
                placeholder={t('assets.create.barcode_placeholder')}
                error={msg(step1Form.formState.errors.barcode?.message)}
                {...step1Form.register('barcode')}
              />
              <div>
                <label
                  htmlFor="asset-status"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t('assets.create.status_label')}
                </label>
                <select
                  id="asset-status"
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  {...step1Form.register('status')}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {label('status', s)}
                    </option>
                  ))}
                </select>
                {step1Form.formState.errors.status && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{step1Form.formState.errors.status.message}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  {t('assets.create.continue')}
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
              {t('assets.create.location_heading')}
            </h2>
            <form onSubmit={handleStep2} className="space-y-4">
              <LocationSelect
                id="asset-location"
                label={t('assets.create.location_label')}
                locations={locations}
                value={step2Form.watch('location_id') ?? null}
                onChange={(id) => step2Form.setValue('location_id', id)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="manufacturer"
                  label={t('assets.create.manufacturer')}
                  placeholder={t('assets.create.manufacturer_placeholder')}
                  {...step2Form.register('manufacturer')}
                />
                <Input
                  id="model"
                  label={t('assets.create.model')}
                  placeholder={t('assets.create.model_placeholder')}
                  {...step2Form.register('model')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="year"
                  label={t('assets.create.year')}
                  type="number"
                  placeholder={String(new Date().getFullYear())}
                  {...step2Form.register('year_manufactured')}
                />
                <Input
                  id="purchase-date"
                  label={t('assets.create.purchase_date')}
                  type="date"
                  {...step2Form.register('purchase_date')}
                />
              </div>
              <Input
                id="warranty-expiry"
                label={t('assets.create.warranty_expiry')}
                type="date"
                {...step2Form.register('warranty_expires_on')}
              />
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  {t('assets.create.back')}
                </Button>
                <Button type="submit">
                  {t('assets.create.continue')}
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
                {t('assets.create.review_heading')}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-3">
                    <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('assets.create.review_name')}</dt>
                    <dd className="font-medium text-gray-900 dark:text-gray-100">{formData.name}</dd>
                  </div>
                  {formData.asset_tag && (
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('assets.create.review_tag')}</dt>
                      <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">{formData.asset_tag}</dd>
                    </div>
                  )}
                  {formData.serial_number && (
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('assets.create.review_serial')}</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formData.serial_number}</dd>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('assets.create.review_status')}</dt>
                    <dd>
                      <AssetStatusBadge status={formData.status as AssetStatus} />
                    </dd>
                  </div>
                  {formData.manufacturer && (
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('assets.create.review_manufacturer')}</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formData.manufacturer}</dd>
                    </div>
                  )}
                  {formData.model && (
                    <div className="flex gap-3">
                      <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('assets.create.review_model')}</dt>
                      <dd className="font-medium text-gray-900 dark:text-gray-100">{formData.model}</dd>
                    </div>
                  )}
                </dl>
                <div className="flex flex-col items-center">
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t('assets.create.preview_qr')}</p>
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
                    <div className="flex h-32 w-32 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
                      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                        {t('assets.create.qr_line1')}
                        <br />
                        {t('assets.create.qr_line2')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              {t('assets.create.back')}
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
            >
              {t('assets.create.create')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
