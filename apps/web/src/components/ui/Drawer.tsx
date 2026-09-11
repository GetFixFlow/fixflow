import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  /** When false, renders as a non-modal floating popup: no dimming overlay, and the rest of the page stays interactive. Defaults to true. */
  overlay?: boolean
}

export function Drawer({ open, onClose, title, description, children, className, overlay = true }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()} modal={overlay}>
      <Dialog.Portal>
        {overlay && (
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        )}
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl dark:bg-gray-800 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            !overlay && 'border-l border-gray-200 dark:border-gray-700',
            className,
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
