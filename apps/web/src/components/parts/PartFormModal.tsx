import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreatePart, useUpdatePart } from '@/hooks/useParts'
import type { Part } from '@/types'

const amount = (label: string, { required }: { required: boolean }) =>
  z
    .string()
    .trim()
    .refine((v) => (required ? v !== '' : true), `${label} is required`)
    .refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), `${label} must be 0 or more`)

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  sku: z.string().trim(),
  unit: z.string().trim().min(1, 'Unit is required'),
  quantity_on_hand: amount('Quantity', { required: false }),
  reorder_point: amount('Reorder point', { required: false }),
  unit_cost: amount('Unit cost', { required: false }),
})

type FormData = z.infer<typeof schema>

interface PartFormModalProps {
  open: boolean
  onClose: () => void
  /** Editing this part; omit to add a new one. */
  part?: Part
}

export function PartFormModal({ open, onClose, part }: PartFormModalProps) {
  const create = useCreatePart()
  const update = useUpdatePart(part?.id ?? 0)
  const pending = create.isPending || update.isPending

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: part?.name ?? '',
      sku: part?.sku ?? '',
      unit: part?.unit ?? 'each',
      quantity_on_hand: '0',
      reorder_point: String(part?.reorder_point ?? 0),
      unit_cost: part?.unit_cost == null ? '' : String(part.unit_cost),
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((data) => {
    const fields = {
      name: data.name,
      sku: data.sku,
      unit: data.unit,
      reorder_point: Number(data.reorder_point || 0),
      unit_cost: data.unit_cost === '' ? null : Number(data.unit_cost),
    }
    if (part) {
      update.mutate(fields, { onSuccess: onClose })
    } else {
      create.mutate({ ...fields, quantity_on_hand: Number(data.quantity_on_hand || 0) }, { onSuccess: onClose })
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={part ? 'Edit part' : 'Add part'}
      description={part ? 'To change how many are in stock, use Adjust stock so the change is recorded.' : undefined}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input id="part-name" label="Name *" error={errors.name?.message} {...form.register('name')} />
        <div className="grid grid-cols-2 gap-3">
          <Input id="part-sku" label="SKU" placeholder="Optional" error={errors.sku?.message} {...form.register('sku')} />
          <Input id="part-unit" label="Unit *" placeholder="each, m, L…" error={errors.unit?.message} {...form.register('unit')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!part && (
            <Input
              id="part-quantity"
              label="Starting stock"
              type="number"
              step="any"
              min="0"
              error={errors.quantity_on_hand?.message}
              {...form.register('quantity_on_hand')}
            />
          )}
          <Input
            id="part-reorder"
            label="Reorder point"
            type="number"
            step="any"
            min="0"
            error={errors.reorder_point?.message}
            {...form.register('reorder_point')}
          />
          <Input
            id="part-cost"
            label="Unit cost"
            type="number"
            step="0.01"
            min="0"
            placeholder="Optional"
            error={errors.unit_cost?.message}
            {...form.register('unit_cost')}
          />
        </div>
        <p className="text-xs text-gray-500">A part is flagged as low when the stock falls to its reorder point or below.</p>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? 'Saving…' : part ? 'Save changes' : 'Add part'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
