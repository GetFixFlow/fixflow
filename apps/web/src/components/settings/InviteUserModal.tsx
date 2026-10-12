import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useInviteUser } from '@/hooks/useUsers'
import type { InviteResult } from '@/types'

const schema = z.object({
  first_name: z.string().min(1, 'First name required'),
  last_name: z.string().min(1, 'Last name required'),
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

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function InviteUserModal({ open, onClose }: InviteUserModalProps) {
  const invite = useInviteUser()
  const [result, setResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)
  const form = useForm<InviteFormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'technician', send_welcome: true },
  })

  const onSubmit = form.handleSubmit((data) => {
    invite.mutate(data, {
      onSuccess: (res) => setResult(res.data),
    })
  })

  const close = () => {
    form.reset()
    setResult(null)
    setCopied(false)
    onClose()
  }

  const copyLink = async () => {
    if (!result) return
    if (await copyToClipboard(result.invitation_url)) {
      setCopied(true)
    } else {
      toast.error('Could not copy. Select the link and copy it by hand.')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {result ? 'Invitation ready' : 'Invite Team Member'}
            </Dialog.Title>
            <button onClick={close} aria-label="Close" className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {result ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {result.email_sent
                  ? `We emailed ${result.user.email}. You can also send them this link yourself:`
                  : `Email is not set up on this server, so nothing was sent. Copy this link and send it to ${result.user.email}:`}
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  aria-label="Invitation link"
                  value={result.invitation_url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-1.5">{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                The link works once and expires in 7 days. You can create a new one from the Users list.
              </p>
              <Button type="button" onClick={close} className="w-full">
                Done
              </Button>
            </div>
          ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="invite_first_name" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  First name *
                </label>
                <Input id="invite_first_name" {...form.register('first_name')} placeholder="Jane" />
                {form.formState.errors.first_name && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.first_name.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="invite_last_name" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Last name *
                </label>
                <Input id="invite_last_name" {...form.register('last_name')} placeholder="Smith" />
                {form.formState.errors.last_name && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.last_name.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="invite_email" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Email *
              </label>
              <Input id="invite_email" {...form.register('email')} type="email" placeholder="jane@company.com" />
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
                Email the invitation (you always get a link to copy)
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
              <Button type="button" variant="outline" onClick={close} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending} className="flex-1">
                {invite.isPending ? 'Creating…' : 'Create Invitation'}
              </Button>
            </div>
          </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
