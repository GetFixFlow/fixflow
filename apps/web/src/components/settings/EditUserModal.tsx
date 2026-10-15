import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useUpdateUser } from '@/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'
import type { User, Role } from '@/types'

const schema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  hourly_rate: z.string().refine((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100000), 'Enter an amount from 0 to 100000, or leave it empty').optional(),
  role: z.enum(['admin', 'manager', 'technician', 'requester']),
})

type EditFormData = z.infer<typeof schema>

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'technician', label: 'Technician' },
  { value: 'requester', label: 'Requester' },
]

interface EditUserModalProps {
  open: boolean
  onClose: () => void
  user: User
}

export function EditUserModal({ open, onClose, user: targetUser }: EditUserModalProps) {
  const { user: currentUser } = useAuthStore()
  const updateUser = useUpdateUser(targetUser.id)
  const isAdmin = currentUser?.role === 'admin'

  const form = useForm<EditFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: targetUser.full_name,
      email: targetUser.email,
      phone: targetUser.phone ?? '',
      job_title: targetUser.job_title ?? '',
      hourly_rate: targetUser.hourly_rate == null ? '' : String(targetUser.hourly_rate),
      role: targetUser.role,
    },
  })

  const onSubmit = form.handleSubmit((data) => {
    const { email: _email, hourly_rate, ...editable } = data // the sign-in email is read-only
    // What someone is paid is the administrator's to see and set; empty means the company's default rate.
    const rate = isAdmin ? { hourly_rate: (hourly_rate ?? '').trim() === '' ? null : Number(hourly_rate) } : {}
    updateUser.mutate({ ...editable, ...rate }, {
      onSuccess: () => {
        onClose()
      },
    })
  })


  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Edit User
            </Dialog.Title>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Full Name *
              </label>
              <Input {...form.register('full_name')} />
              {form.formState.errors.full_name && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Email *
              </label>
              <Input {...form.register('email')} type="email" disabled />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Phone
              </label>
              <Input {...form.register('phone')} type="tel" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Job Title
              </label>
              <Input {...form.register('job_title')} />
            </div>

            {isAdmin && (
              <div>
                <label htmlFor="hourly-rate" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Hourly rate
                </label>
                <Input id="hourly-rate" {...form.register('hourly_rate')} type="number" min={0} step="0.01" placeholder="Company default" />
                <p className="text-xs text-gray-500 mt-1">Used to cost the hours this person records on work orders. Leave empty to use the company default rate. Only administrators see this.</p>
                {form.formState.errors.hourly_rate && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.hourly_rate.message}</p>
                )}
              </div>
            )}

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Role
                </label>
                <select
                  {...form.register('role')}
                  className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={updateUser.isPending} className="flex-1">
                {updateUser.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
