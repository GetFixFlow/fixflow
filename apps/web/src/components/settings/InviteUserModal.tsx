import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useInviteUser } from '@/hooks/useUsers'

const schema = z.object({
  full_name: z.string().min(2, 'Name required'),
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'manager', 'technician', 'requester']),
  send_welcome: z.boolean(),
  message: z.string().optional(),
})

type InviteFormData = z.infer<typeof schema>

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', desc: 'Full access. Can manage users, settings, and all data.' },
  { value: 'manager', label: 'Manager', desc: 'Can create/verify WOs, manage PM and IoT, view all reports.' },
  { value: 'technician', label: 'Technician', desc: 'Can view and complete assigned work orders and PM tasks.' },
  { value: 'requester', label: 'Requester', desc: 'Can submit work requests and view their status only.' },
] as const

interface InviteUserModalProps {
  open: boolean
  onClose: () => void
}

export function InviteUserModal({ open, onClose }: InviteUserModalProps) {
  const invite = useInviteUser()
  const form = useForm<InviteFormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'technician', send_welcome: true },
  })

  const onSubmit = form.handleSubmit((data) => {
    invite.mutate(data, {
      onSuccess: () => {
        form.reset()
        onClose()
      },
    })
  })

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Invite Team Member
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
              <Input {...form.register('full_name')} placeholder="Jane Smith" />
              {form.formState.errors.full_name && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Email *
              </label>
              <Input {...form.register('email')} type="email" placeholder="jane@company.com" />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Role *
              </label>
              <Controller
                name="role"
                control={form.control}
                render={({ field }) => (
                  <div className="space-y-2">
                    {ROLE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                        style={{ borderColor: field.value === opt.value ? '#2563eb' : undefined }}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          checked={field.value === opt.value}
                          onChange={() => field.onChange(opt.value)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{opt.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="send_welcome"
                {...form.register('send_welcome')}
                className="rounded"
              />
              <label htmlFor="send_welcome" className="text-sm text-gray-700 dark:text-gray-300">
                Send welcome email
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Personal Message (optional)
              </label>
              <textarea
                {...form.register('message')}
                rows={2}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Welcome to our team!"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending} className="flex-1">
                {invite.isPending ? 'Sending…' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
