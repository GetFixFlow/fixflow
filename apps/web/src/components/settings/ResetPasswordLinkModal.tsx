import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { copyToClipboard } from '@/components/settings/InviteUserModal'

interface ResetPasswordLinkModalProps {
  open: boolean
  onClose: () => void
  person: string
  email: string
  resetUrl: string
  emailSent: boolean
}

export function ResetPasswordLinkModal({ open, onClose, person, email, resetUrl, emailSent }: ResetPasswordLinkModalProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (await copyToClipboard(resetUrl)) setCopied(true)
    else toast.error('Could not copy. Select the link and copy it by hand.')
  }

  return (
    <Modal open={open} onClose={onClose} title="Password reset link">
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {emailSent
            ? `We emailed ${email}. You can also give ${person} this link yourself:`
            : `Email is not set up on this server, so nothing was sent. Give ${person} this link:`}
        </p>
        <div className="flex gap-2">
          <Input
            readOnly
            aria-label="Reset link"
            value={resetUrl}
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-1.5">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          The link works once and expires in 6 hours. {person}'s current password keeps working until they use it.
        </p>
        <Button type="button" onClick={onClose} className="w-full">
          Done
        </Button>
      </div>
    </Modal>
  )
}
