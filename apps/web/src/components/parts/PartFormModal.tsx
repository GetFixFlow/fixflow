import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CustomFieldInputs } from '@/components/custom-fields/CustomFieldInputs'
import { useCreatePart, useUpdatePart } from '@/hooks/useParts'
import { activeFields, useCustomFields } from '@/hooks/useCustomFields'
import { missingRequired, toInputValues, toPayload, type CustomInputValues } from '@/lib/customFields'
import type { Part } from '@/types'

const amount = (t: TFunction, label: string, { required }: { required: boolean }) =>
  z
    .string()
    .trim()
    .refine((v) => (required ? v !== '' : true), t('parts.form.required', { label }))
    .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), t('parts.form.min_zero', { label }))

// Built when the form is drawn, so that its messages are in the language of the screens.
const makeSchema = (t: TFunction) => z.object({
  name: z.string().trim().min(1, t('parts.form.name_required')),
  sku: z.string().trim(),
  unit: z.string().trim().min(1, t('parts.form.unit_required')),
  quantity_on_hand: amount(t, t('parts.form.quantity'), { required: false }),
  reorder_point: amount(t, t('parts.form.reorder_point'), { required: false }),
  unit_cost: amount(t, t('parts.form.unit_cost'), { required: false }),
})

type FormData = z.infer<ReturnType<typeof makeSchema>>

interface PartFormModalProps {
  open: boolean
  onClose: () => void
  /** Editing this part; omit to add a new one. */
  part?: Part
}

export function PartFormModal({ open, onClose, part }: PartFormModalProps) {
  const { t } = useTranslation()
  const create = useCreatePart()
  const update = useUpdatePart(part?.id ?? 0)
  const pending = create.isPending || update.isPending

  const form = useForm<FormData>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: {
      name: part?.name ?? '',
      sku: part?.sku ?? '',
      unit: part?.unit ?? t('parts.form.default_unit'),
      quantity_on_hand: '0',
      reorder_point: String(part?.reorder_point ?? 0),
      unit_cost: part?.unit_cost == null ? '' : String(part.unit_cost),
    },
  })
  const { errors } = form.formState

  const customFields = activeFields(useCustomFields('part').data)
  const [startValues] = useState<CustomInputValues>(() => toInputValues(part?.custom_values))
  const [customValues, setCustomValues] = useState<CustomInputValues>(startValues)
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})

  const onSubmit = form.handleSubmit((data) => {
    const fields = {
      name: data.name,
      sku: data.sku,
      unit: data.unit,
      reorder_point: Number(data.reorder_point || 0),
      unit_cost: data.unit_cost === '' ? null : Number(data.unit_cost),
    }
    // Like a work order: a new part sends every custom field, an edit only when one changed.
    const sent = toPayload(customFields, customValues)
    const changed = !part || JSON.stringify(sent) !== JSON.stringify(toPayload(customFields, startValues))
    if (changed) {
      const missing = missingRequired(customFields, customValues)
      setCustomErrors(missing)
      if (Object.keys(missing).length > 0) return
    }
    const withCustom = changed ? { ...fields, custom_values: sent } : fields
    if (part) {
      update.mutate(withCustom, { onSuccess: onClose })
    } else {
      create.mutate({ ...withCustom, quantity_on_hand: Number(data.quantity_on_hand || 0) }, { onSuccess: onClose })
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={part ? t('parts.form.edit_title') : t('parts.form.add_title')}
      description={part ? t('parts.form.edit_description') : undefined}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input id="part-name" label={t('parts.form.name')} error={errors.name?.message} {...form.register('name')} />
        <div className="grid grid-cols-2 gap-3">
          <Input id="part-sku" label={t('parts.form.sku')} placeholder={t('parts.form.optional')} error={errors.sku?.message} {...form.register('sku')} />
          <Input id="part-unit" label={t('parts.form.unit')} placeholder={t('parts.form.unit_placeholder')} error={errors.unit?.message} {...form.register('unit')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!part && (
            <Input
              id="part-quantity"
              label={t('parts.form.starting_stock')}
              type="number"
              step="any"
              min="0"
              error={errors.quantity_on_hand?.message}
              {...form.register('quantity_on_hand')}
            />
          )}
          <Input
            id="part-reorder"
            label={t('parts.form.reorder_point')}
            type="number"
            step="any"
            min="0"
            error={errors.reorder_point?.message}
            {...form.register('reorder_point')}
          />
          <Input
            id="part-cost"
            label={t('parts.form.unit_cost')}
            type="number"
            step="0.01"
            min="0"
            placeholder={t('parts.form.optional')}
            error={errors.unit_cost?.message}
            {...form.register('unit_cost')}
          />
        </div>
        {customFields.length > 0 && (
          <CustomFieldInputs fields={customFields} values={customValues} onChange={setCustomValues} errors={customErrors} idPrefix="part-cf" />
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('parts.form.low_help')}</p>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.actions.cancel')}</Button>
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? t('common.actions.saving') : part ? t('parts.form.save_changes') : t('parts.form.add')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
