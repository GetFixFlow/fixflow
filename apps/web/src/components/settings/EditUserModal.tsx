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

  const form = useForm<EditFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: targetUser.full_name,
      email: targetUser.email,
      phone: targetUser.phone ?? '',
      job_title: (targetUser as Record<string, unknown>).job_title as string ?? '',
      role: targetUser.role,
    },
  })

  const onSubmit = form.handleSubmit((data) => {
    updateUser.mutate(data, {
      onSuccess: () => {
        onClose()
      },
    })
  })

  const isAdmin = currentUser?.role === 'admin'

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
              <Input {...form.register('email')} type="email" />
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
