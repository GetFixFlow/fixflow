import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateVendor, useUpdateVendor } from '@/hooks/useVendors'
import type { Vendor } from '@/types'

// Built when the form is drawn, so that its messages are in the language of the screens.
const makeSchema = (t: TFunction) => z.object({
  name: z.string().trim().min(1, t('vendors.form.name_required')),
  category: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim().refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), t('vendors.form.email_invalid')),
  website: z.string().trim(),
  address: z.string().trim(),
  notes: z.string().trim(),
  active: z.boolean(),
})

type FormData = z.infer<ReturnType<typeof makeSchema>>

interface VendorFormModalProps {
  open: boolean
  onClose: () => void
  /** Editing this vendor; omit to add a new one. */
  vendor?: Vendor
}

const textareaClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

export function VendorFormModal({ open, onClose, vendor }: VendorFormModalProps) {
  const { t } = useTranslation()
  const create = useCreateVendor()
  const update = useUpdateVendor(vendor?.id ?? 0)
  const pending = create.isPending || update.isPending

  const form = useForm<FormData>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: {
      name: vendor?.name ?? '',
      category: vendor?.category ?? '',
      phone: vendor?.phone ?? '',
      email: vendor?.email ?? '',
      website: vendor?.website ?? '',
      address: vendor?.address ?? '',
      notes: vendor?.notes ?? '',
      active: vendor?.active ?? true,
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((data) => {
    // An empty field is sent as nothing, so a cleared phone number really is cleared.
    const fields = {
      name: data.name,
      category: data.category || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      address: data.address || null,
      notes: data.notes || null,
    }
    if (vendor) update.mutate({ ...fields, active: data.active }, { onSuccess: onClose })
    else create.mutate(fields, { onSuccess: onClose })
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vendor ? t('vendors.form.edit_title') : t('vendors.form.add_title')}
      description={vendor ? undefined : t('vendors.form.add_description')}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input id="vendor-name" label={t('vendors.form.name')} error={errors.name?.message} {...form.register('name')} />
        <Input
          id="vendor-category"
          label={t('vendors.form.category')}
          placeholder={t('vendors.form.category_placeholder')}
          error={errors.category?.message}
          {...form.register('category')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input id="vendor-phone" label={t('vendors.form.phone')} error={errors.phone?.message} {...form.register('phone')} />
          <Input id="vendor-email" label={t('vendors.form.email')} type="email" error={errors.email?.message} {...form.register('email')} />
        </div>
        <Input id="vendor-website" label={t('vendors.form.website')} error={errors.website?.message} {...form.register('website')} />
        <div>
          <label htmlFor="vendor-address" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('vendors.form.address')}</label>
          <textarea id="vendor-address" rows={2} className={textareaClass} {...form.register('address')} />
        </div>
        <div>
          <label htmlFor="vendor-notes" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('vendors.form.notes')}</label>
          <textarea id="vendor-notes" rows={3} className={textareaClass} {...form.register('notes')} />
        </div>
        {vendor && (
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" className="mt-0.5 rounded border-gray-300" {...form.register('active')} />
            <span>
              {t('vendors.form.active')}
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {t('vendors.form.active_help')}
              </span>
            </span>
          </label>
        )}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.actions.cancel')}</Button>
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? t('common.actions.saving') : vendor ? t('vendors.form.save_changes') : t('vendors.form.add')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
